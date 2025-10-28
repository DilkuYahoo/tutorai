import json
import os
import boto3
import uuid
from datetime import datetime
from decimal import Decimal
from botocore.exceptions import ClientError, NoCredentialsError

# Base directory for file paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# S3 configuration from environment variables
S3_BUCKET = os.environ.get("S3_BUCKET", "hsc-agent-bucket-2")
S3_KEY_PREFIX = os.environ.get("S3_KEY_PREFIX", "data/")
S3_QUESTIONS_KEY = f"{S3_KEY_PREFIX}1984_vocab.json"

# Initialize S3 client
s3_client = boto3.client('s3')

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb')
attempts_table = dynamodb.Table('hsc_agent_quiz_attempts')
questions_table = dynamodb.Table('hsc_agent_questions_mapping')


def get_question_location_from_dynamodb(year, subject, area, stage):
    """Get question file location and id from DynamoDB"""
    try:
        print(f"LOG: Scanning DynamoDB for question location - year: {year}, subject: {subject}, area: {area}, stage: {stage}")
        response = questions_table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('year').eq(year) &
                           boto3.dynamodb.conditions.Attr('subject').eq(subject) &
                           boto3.dynamodb.conditions.Attr('area').eq(area) &
                           boto3.dynamodb.conditions.Attr('stage').eq(stage)
        )
        items = response.get('Items', [])
        if items:
            item = items[0]
            location = item.get('location')
            mapping_id = item.get('id')
            print(f"LOG: Found question location in DynamoDB: {location}, id: {mapping_id}")
            return location, mapping_id
        else:
            print(f"LOG: No item found in DynamoDB for year: {year}, subject: {subject}, area: {area}, stage: {stage}")
        return None, None
    except ClientError as e:
        print(f"LOG: ERROR - Failed to scan DynamoDB: {str(e)}")
        print(f"LOG: ERROR - Error code: {e.response['Error']['Code']}, Message: {e.response['Error']['Message']}")
        return None, None
    except Exception as e:
        print(f"LOG: ERROR - Unexpected error scanning DynamoDB: {str(e)}")
        return None, None

def get_next_stage(year, subject, area, current_stage):
    """Get the next stage number for the given year, subject, area"""
    try:
        next_stage = str(int(current_stage) + 1)
        print(f"LOG: Checking for next stage: {next_stage}")
        response = questions_table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('year').eq(year) &
                           boto3.dynamodb.conditions.Attr('subject').eq(subject) &
                           boto3.dynamodb.conditions.Attr('area').eq(area) &
                           boto3.dynamodb.conditions.Attr('stage').eq(next_stage)
        )
        items = response.get('Items', [])
        if items:
            print(f"LOG: Next stage {next_stage} found")
            return next_stage
        else:
            print(f"LOG: No next stage found for {next_stage}")
            return None
    except ClientError as e:
        print(f"LOG: ERROR - Failed to scan for next stage: {str(e)}")
        return None
    except Exception as e:
        print(f"LOG: ERROR - Unexpected error getting next stage: {str(e)}")
        return None

def get_current_stage_for_user(user_id, year, subject, area):
    """Determine the current stage for a user based on their latest attempt"""
    try:
        print(f"LOG: Querying attempts for user_id: {user_id}")
        response = attempts_table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr('user_id').eq(user_id)
        )
        items = response.get('Items', [])
        if not items:
            print(f"LOG: No attempts found for user_id: {user_id}, starting at stage 1")
            return '1', None  # Start at stage 1 if no attempts

        # Sort by timestamp descending to get latest
        items.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        latest_attempt = items[0]
        success_percentage = float(latest_attempt.get('success_percentage', 0))
        questions_mapping_id = latest_attempt.get('questions_mapping_id')

        if success_percentage == 100.0:
            # Advance to next stage
            current_stage = get_stage_from_mapping_id(questions_mapping_id)
            next_stage = get_next_stage(year, subject, area, current_stage)
            if next_stage:
                print(f"LOG: User {user_id} advanced to stage {next_stage}")
                return next_stage, None
            else:
                print(f"LOG: User {user_id} completed all stages")
                return current_stage, 'completed'  # No more stages
        else:
            # Retry current stage
            current_stage = get_stage_from_mapping_id(questions_mapping_id)
            print(f"LOG: User {user_id} retrying stage {current_stage}")
            return current_stage, None
    except ClientError as e:
        print(f"LOG: ERROR - Failed to query attempts: {str(e)}")
        return '1', None
    except Exception as e:
        print(f"LOG: ERROR - Unexpected error getting current stage: {str(e)}")
        return '1', None

def get_stage_from_mapping_id(mapping_id):
    """Get stage from questions_mapping_id by querying questions_table"""
    if not mapping_id:
        return '1'
    try:
        response = questions_table.get_item(Key={'id': mapping_id})
        item = response.get('Item')
        if item:
            return item.get('stage', '1')
        return '1'
    except ClientError as e:
        print(f"LOG: ERROR - Failed to get stage from mapping_id: {str(e)}")
        return '1'
    except Exception as e:
        print(f"LOG: ERROR - Unexpected error getting stage: {str(e)}")
        return '1'

def load_questions_from_s3(stage='1', year='12', subject='Advanced English', area='vocab'):
    """Load questions from S3 bucket using location from DynamoDB for the given stage"""
    # Query DynamoDB for question location
    s3_key, mapping_id = get_question_location_from_dynamodb(year, subject, area, stage)
    
    if not s3_key:
        # Fallback to environment variable
        print(f"LOG: DynamoDB query failed, falling back to environment variable")
        s3_key = S3_QUESTIONS_KEY
    
    try:
        print(f"DEBUG: Attempting to load from bucket: {S3_BUCKET}, key: {s3_key}")
        print(f"DEBUG: S3 client region: {s3_client.meta.region_name}")
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        content = response['Body'].read().decode('utf-8')
        q_data = json.loads(content)
        print(f"DEBUG: Successfully loaded {len(q_data.get('questions', []))} questions for stage {stage}")
        return q_data.get("questions", []), q_data.get("title", "1984 Vocabulary Booster")
    except NoCredentialsError:
        print("DEBUG: No AWS credentials configured")
        raise Exception("AWS credentials not configured")
    except ClientError as e:
        print(f"DEBUG: ClientError - Code: {e.response['Error']['Code']}, Message: {e.response['Error']['Message']}")
        if e.response['Error']['Code'] == 'NoSuchKey':
            raise Exception(f"Questions file not found in S3: {s3_key}")
        elif e.response['Error']['Code'] == 'NoSuchBucket':
            raise Exception(f"S3 bucket not found: {S3_BUCKET}")
        else:
            raise Exception(f"S3 error: {str(e)}")
    except Exception as e:
        print(f"DEBUG: Unexpected error: {str(e)}")
        raise Exception(f"Error loading questions from S3: {str(e)}")

def get_filter_options():
    """Get distinct values for year, subject, area from DynamoDB"""
    try:
        print(f"LOG: Scanning DynamoDB for filter options")
        response = questions_table.scan()
        items = response.get('Items', [])
        
        years = set()
        subjects = set()
        areas = set()
        
        for item in items:
            years.add(item.get('year'))
            subjects.add(item.get('subject'))
            areas.add(item.get('area'))
        
        options = {
            'years': sorted(list(years)),
            'subjects': sorted(list(subjects)),
            'areas': sorted(list(areas))
        }
        print(f"LOG: Found filter options - years: {options['years']}, subjects: {options['subjects']}, areas: {options['areas']}")
        return options
    except ClientError as e:
        print(f"LOG: ERROR - Failed to scan for filter options: {str(e)}")
        return {'years': [], 'subjects': [], 'areas': []}
    except Exception as e:
        print(f"LOG: ERROR - Unexpected error getting filter options: {str(e)}")
        return {'years': [], 'subjects': [], 'areas': []}

def serve_metadata(event):
    """Serve metadata (title, author, and poem) from S3 JSON"""
    try:
        query_params = event.get("queryStringParameters", {})
        year = query_params.get("year", '12')
        subject = query_params.get("subject", 'Advanced English')
        area = query_params.get("area", 'vocab')
        stage = '1'  # Default to stage 1 for metadata
        s3_key, mapping_id = get_question_location_from_dynamodb(year, subject, area, stage)
        if not s3_key:
            s3_key = S3_QUESTIONS_KEY
        
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        content = response['Body'].read().decode('utf-8')
        q_data = json.loads(content)
        
        title = q_data.get("title", "1984 Vocabulary Booster")
        author = q_data.get("author", "Unknown Author")
        poem = q_data.get("poem", "")
        
        payload = {"title": title, "author": author, "poem": poem}
        print(f"LOG: Serving metadata - title: {title}, author: {author}, poem: {poem[:50]}...")
        return build_response(200, payload)
    except Exception as e:
        print(f"LOG: ERROR - Failed to load metadata: {str(e)}")
        return build_response(500, {"error": "Failed to load metadata", "message": str(e)})

# Global variables for questions and title, loaded dynamically per request
QUESTIONS = []
TITLE = ""

# Helper: load HTML from S3 static directory
def load_index_html():
    s3_key = "static/index.html"
    try:
        print(f"DEBUG: Attempting to load index.html from S3 bucket: {S3_BUCKET}, key: {s3_key}")
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        content = response['Body'].read().decode('utf-8')
        print(f"DEBUG: Successfully loaded index.html from S3 ({len(content)} characters)")
        return content
    except ClientError as e:
        print(f"DEBUG: S3 ClientError loading index.html - Code: {e.response['Error']['Code']}, Message: {e.response['Error']['Message']}")
        if e.response['Error']['Code'] == 'NoSuchKey':
            print(f"DEBUG: index.html not found in S3 at {s3_key}")
        elif e.response['Error']['Code'] == 'NoSuchBucket':
            print(f"DEBUG: S3 bucket not found: {S3_BUCKET}")
        else:
            print(f"DEBUG: S3 error loading index.html: {str(e)}")
    except NoCredentialsError:
        print("DEBUG: No AWS credentials configured for S3 index.html access")
    except Exception as e:
        print(f"DEBUG: Unexpected error loading index.html from S3: {str(e)}")
    
    # Fallback HTML if S3 loading fails
    return "<html><body><h1>Index not found</h1></body></html>"

def load_filter_html():
    s3_key = "static/filter.html"
    try:
        print(f"DEBUG: Attempting to load filter.html from S3 bucket: {S3_BUCKET}, key: {s3_key}")
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        content = response['Body'].read().decode('utf-8')
        print(f"DEBUG: Successfully loaded filter.html from S3 ({len(content)} characters)")
        return content
    except ClientError as e:
        print(f"DEBUG: S3 ClientError loading filter.html - Code: {e.response['Error']['Code']}, Message: {e.response['Error']['Message']}")
        if e.response['Error']['Code'] == 'NoSuchKey':
            print(f"DEBUG: filter.html not found in S3 at {s3_key}")
        elif e.response['Error']['Code'] == 'NoSuchBucket':
            print(f"DEBUG: S3 bucket not found: {S3_BUCKET}")
        else:
            print(f"DEBUG: S3 error loading filter.html: {str(e)}")
    except NoCredentialsError:
        print("DEBUG: No AWS credentials configured for S3 filter.html access")
    except Exception as e:
        print(f"DEBUG: Unexpected error loading filter.html from S3: {str(e)}")
    
    # Fallback HTML if S3 loading fails
    return "<html><body><h1>Filter page not found</h1></body></html>"

INDEX_HTML = load_index_html()

# Helpers to support both REST (proxy) and HTTP API event shapes
def get_path(event):
    # HTTP API (v2) uses rawPath and includes stage
    if "rawPath" in event:
        path = event["rawPath"]
        # Strip stage from path if present (HTTP API includes stage in rawPath)
        if "requestContext" in event and "stage" in event["requestContext"]:
            stage = event["requestContext"]["stage"]
            if path.startswith(f"/{stage}"):
                path = path[len(f"/{stage}"):]
        return path
    # REST API (v1) uses path (stage not included)
    return event.get("path") or "/"

def get_method(event):
    # HTTP API (v2) uses requestContext.http.method
    if "requestContext" in event and "http" in event["requestContext"]:
        return event["requestContext"]["http"]["method"]
    # REST API (v1) uses httpMethod
    return event.get("httpMethod", "GET")

def get_source_ip(event):
    # HTTP API (v2) uses requestContext.http.sourceIp
    if "requestContext" in event and "http" in event["requestContext"]:
        return event["requestContext"]["http"].get("sourceIp", "unknown")
    # REST API (v1) uses requestContext.identity.sourceIp
    if "requestContext" in event and "identity" in event["requestContext"]:
        return event["requestContext"]["identity"].get("sourceIp", "unknown")
    return "unknown"

def get_user_id(event):
    # First, check for user_id in query parameters
    query_params = event.get("queryStringParameters", {})
    if query_params and "user_id" in query_params:
        return query_params["user_id"]
    # Fallback to source IP
    return get_source_ip(event)

def build_response(status_code=200, body="", headers=None, is_base64=False):
    default_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }
    if headers:
        default_headers.update(headers)
    return {
        "statusCode": status_code,
        "headers": default_headers,
        "body": body if isinstance(body, str) else json.dumps(body),
        "isBase64Encoded": is_base64,
    }

def serve_questions(event):
    user_id = get_user_id(event)
    query_params = event.get("queryStringParameters", {})
    year = query_params.get("year", '12')
    subject = query_params.get("subject", 'Advanced English')
    area = query_params.get("area", 'vocab')
    current_stage, status = get_current_stage_for_user(user_id, year, subject, area)
    if status == 'completed':
        print(f"LOG: User {user_id} has completed all stages")
        return build_response(200, {"message": "Congratulations! You have completed all stages.", "questions": [], "title": "Completed"})
    
    global QUESTIONS, TITLE
    QUESTIONS, TITLE = load_questions_from_s3(current_stage, year, subject, area)
    print(f"LOG: serve_questions() called for user {user_id} at stage {current_stage} - preparing {len(QUESTIONS)} questions for response")
    # Return the questions array (no answers). We intentionally exclude 'answer' field
    safe_questions = []
    for q in QUESTIONS:
        safe_q = {
            "id": q.get("id"),
            "word": q.get("word"),
            "context": q.get("context"),
            "question": q.get("question"),
            "options": q.get("options"),
        }
        safe_questions.append(safe_q)
    print(f"LOG: Filtered {len(safe_questions)} questions (removed answer fields for security)")
    payload = {"title": TITLE, "questions": safe_questions, "stage": current_stage}
    return build_response(200, payload)

def write_attempt_to_dynamodb(user_id, success_percentage, mapping_id):
    attempt_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat()
    item = {
        'attempt_id': attempt_id,  # Partition key: UUID
        'user_id': user_id,
        'timestamp': timestamp,
        'success_percentage': Decimal(str(success_percentage)),
        'questions_mapping_id': mapping_id
    }
    print(f"LOG: Preparing to insert into DynamoDB table '{attempts_table.table_name}'")
    # Convert Decimal to float for logging
    log_item = {k: float(v) if isinstance(v, Decimal) else v for k, v in item.items()}
    print(f"LOG: Item to insert: {json.dumps(log_item, indent=2)}")
    try:
        response = attempts_table.put_item(Item=item)
        print(f"LOG: Successfully inserted item into DynamoDB")
        print(f"LOG: Response metadata: {response['ResponseMetadata']['HTTPStatusCode']}")
        print(f"LOG: Recorded attempt - attempt_id: {attempt_id}, user_id: {user_id}, success_percentage: {success_percentage}, timestamp: {timestamp}, questions_mapping_id: {mapping_id}")
    except ClientError as e:
        print(f"LOG: ERROR - Failed to write to DynamoDB: {str(e)}")
        print(f"LOG: ERROR - Error code: {e.response['Error']['Code']}, Message: {e.response['Error']['Message']}")
    except Exception as e:
        print(f"LOG: ERROR - Unexpected error writing to DynamoDB: {str(e)}")

def validate_submission(body_json, user_id, year, subject, area):
    """
    Expecting:
    {
        "answers": { "<id>": "A" | "B" | "C" | "D" | "<option text>" , ... }
    }
    """
    print(f"LOG: validate_submission() called - starting quiz validation process")
    current_stage, status = get_current_stage_for_user(user_id, year, subject, area)
    answers = body_json.get("answers", {})

    # Load questions locally for validation (includes answers)
    questions, _ = load_questions_from_s3(current_stage, year, subject, area)
    total = len(questions)
    correct = 0
    per_question = []
    print(f"LOG: Processing {total} total questions with {len(answers)} submitted answers")

    # Build a lookup by id
    lookup = {q.get("id"): q for q in questions}
    print(f"LOG: Built lookup table for {len(lookup)} questions by ID")

    for q in questions:
        qid = str(q.get("id"))
        provided = answers.get(qid)
        correct_answer_text = q.get("answer")  # the canonical answer string
        options = q.get("options", [])

        # Determine correctness if provided
        is_correct = False
        chosen_text = None

        if provided is None:
            chosen_text = None
        else:
            # If user provided letter (A/B/C/D) -> map to option index
            p = str(provided).strip().upper()
            if p in ("A", "B", "C", "D"):
                idx = ord(p) - 65
                if 0 <= idx < len(options):
                    chosen_text = options[idx]
            else:
                # assume they posted option text
                chosen_text = provided

        if chosen_text is not None and chosen_text == correct_answer_text:
            is_correct = True
            correct += 1
            print(f"LOG: Question {qid} - CORRECT: '{chosen_text}' matches answer '{correct_answer_text}'")
        elif chosen_text is not None:
            print(f"LOG: Question {qid} - INCORRECT: chose '{chosen_text}', correct was '{correct_answer_text}'")
        else:
            print(f"LOG: Question {qid} - NO ANSWER provided")

        per_question.append({
            "id": qid,
            "word": q.get("word"),
            "chosen": chosen_text,
            "correct_answer": correct_answer_text,
            "is_correct": is_correct,
        })

    score = {
        "total": total,
        "correct": correct,
        "percent": round((correct / total) * 100, 1) if total else 0,
        "details": per_question
    }
    print(f"LOG: Quiz validation complete - {correct}/{total} correct ({score['percent']}%)")

    # Write to DynamoDB
    print(f"LOG: Attempting to record attempt in DynamoDB for user_id: {user_id}")
    s3_key, mapping_id = get_question_location_from_dynamodb(year, subject, area, current_stage)
    write_attempt_to_dynamodb(user_id, score['percent'], mapping_id)

    # Check if 100% success and advance stage if possible
    if score['percent'] == 100.0:
        next_stage = get_next_stage(year, subject, area, current_stage)
        if next_stage:
            print(f"LOG: User {user_id} achieved 100%, advancing to stage {next_stage}")
            score['next_stage'] = next_stage
            score['message'] = f"Congratulations! You've advanced to stage {next_stage}."
        else:
            print(f"LOG: User {user_id} completed all stages")
            score['completed'] = True
            score['message'] = "Congratulations! You have completed all stages."
    else:
        print(f"LOG: User {user_id} needs to retry stage {current_stage}")
        score['retry'] = True
        score['message'] = f"Keep trying! Retry stage {current_stage} to improve."

    return build_response(200, score)

def calculate_sum(body_json):
    """
    Expecting:
    {
      "num1": <number>,
      "num2": <number>
    }
    """
    print(f"LOG: calculate_sum() called - processing number addition")
    try:
        num1 = float(body_json.get("num1", 0))
        num2 = float(body_json.get("num2", 0))
        result = num1 + num2
        print(f"LOG: Calculation complete - {num1} + {num2} = {result}")
        return build_response(200, {"sum": result, "num1": num1, "num2": num2})
    except (ValueError, TypeError) as e:
        print(f"LOG: ERROR - Invalid number format in calculate_sum: {str(e)}")
        return build_response(400, {"error": "Invalid number format", "message": str(e)})

def lambda_handler(event, context):
    print(f"LOG: Lambda function invoked - Event keys: {list(event.keys())}")
    print(f"LOG: Context function name: {context.function_name if context else 'Unknown'}")

    method = get_method(event)
    path = get_path(event)
    print(f"LOG: Request method: {method}, path: {path}")

    # Handle preflight
    if method == "OPTIONS":
        print(f"LOG: Handling CORS preflight request")
        return build_response(200, "")

    # Normalize path to remove trailing slashes for matching
    p = path.rstrip("/")
    print(f"LOG: Normalized path: '{p}'")

    try:
        if method == "GET" and (p == "" or p == "/" or p == "/quiz" or p == "/index.html"):
            print(f"LOG: Serving static HTML page (index.html)")
            # serve static SPA
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "text/html; charset=utf-8",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": INDEX_HTML,
            }

        if method == "GET" and p == "/filter.html":
            print(f"LOG: Serving static HTML page (filter.html)")
            # Load filter.html from S3 or fallback
            filter_html = load_filter_html()
            return {
                "statusCode": 200,
                "headers": {
                    "Content-Type": "text/html; charset=utf-8",
                    "Access-Control-Allow-Origin": "*",
                },
                "body": filter_html,
            }

        if method == "GET" and p == "/questions":
            print(f"LOG: Processing GET request for questions endpoint")
            return serve_questions(event)

        if method == "GET" and p == "/metadata":
            print(f"LOG: Processing GET request for metadata endpoint")
            return serve_metadata(event)

        if method == "GET" and p == "/filters":
            print(f"LOG: Processing GET request for filters endpoint")
            options = get_filter_options()
            return build_response(200, options)

        if method == "POST" and p == "/submit":
            print(f"LOG: Processing POST request for submit endpoint")
            # parse body (API gateway may pass as string)
            body = event.get("body", "")
            print(f"LOG: Raw body length: {len(body) if body else 0} characters")
            if event.get("isBase64Encoded"):
                print(f"LOG: Body is base64 encoded, decoding...")
                import base64
                body = base64.b64decode(body).decode("utf-8")
                print(f"LOG: Decoded body length: {len(body)} characters")
            try:
                body_json = json.loads(body) if body else {}
                print(f"LOG: Successfully parsed JSON body with keys: {list(body_json.keys())}")
                answers_count = len(body_json.get('answers', {}))
                print(f"LOG: Quiz submission contains {answers_count} answers")
            except Exception as e:
                print(f"LOG: ERROR - Failed to parse JSON body: {str(e)}")
                return build_response(400, {"error": "invalid json body"})
            user_id = body_json.get('user_id', get_user_id(event))
            query_params = event.get("queryStringParameters", {})
            year = query_params.get("year", '12')
            subject = query_params.get("subject", 'Advanced English')
            area = query_params.get("area", 'vocab')
            return validate_submission(body_json, user_id, year, subject, area)

        if method == "POST" and p == "/sum":
            print(f"LOG: Processing POST request for sum endpoint")
            # parse body (API gateway may pass as string)
            body = event.get("body", "")
            print(f"LOG: Raw body length: {len(body) if body else 0} characters")
            if event.get("isBase64Encoded"):
                print(f"LOG: Body is base64 encoded, decoding...")
                import base64
                body = base64.b64decode(body).decode("utf-8")
                print(f"LOG: Decoded body length: {len(body)} characters")
            try:
                body_json = json.loads(body) if body else {}
                print(f"LOG: Successfully parsed JSON body with keys: {list(body_json.keys())}")
                print(f"LOG: Sum request - num1: {body_json.get('num1', 'not provided')}, num2: {body_json.get('num2', 'not provided')}")
            except Exception as e:
                print(f"LOG: ERROR - Failed to parse JSON body: {str(e)}")
                return build_response(400, {"error": "invalid json body"})
            return calculate_sum(body_json)

        # Not found
        print(f"LOG: ERROR - Endpoint not found: {method} {path}")
        return build_response(404, {"error": "not found", "path": path})

    except Exception as e:
        # generic error
        print(f"LOG: ERROR - Unexpected server error in lambda_handler: {str(e)}")
        return build_response(500, {"error": "server error", "message": str(e)})
