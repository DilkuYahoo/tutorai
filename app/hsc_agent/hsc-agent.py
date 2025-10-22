import json
import os
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Base directory for file paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# S3 configuration from environment variables
S3_BUCKET = os.environ.get("S3_BUCKET", "hsc-agent-bucket-2")
S3_KEY_PREFIX = os.environ.get("S3_KEY_PREFIX", "data/")
S3_QUESTIONS_KEY = f"{S3_KEY_PREFIX}1984_vocab.json"

# Initialize S3 client
s3_client = boto3.client('s3')

def load_questions_from_s3():
    """Load questions from S3 bucket"""
    try:
        print(f"DEBUG: Attempting to load from bucket: {S3_BUCKET}, key: {S3_QUESTIONS_KEY}")
        print(f"DEBUG: S3 client region: {s3_client.meta.region_name}")
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=S3_QUESTIONS_KEY)
        content = response['Body'].read().decode('utf-8')
        q_data = json.loads(content)
        print(f"DEBUG: Successfully loaded {len(q_data.get('questions', []))} questions")
        return q_data.get("questions", []), q_data.get("title", "1984 Vocabulary Booster")
    except NoCredentialsError:
        print("DEBUG: No AWS credentials configured")
        raise Exception("AWS credentials not configured")
    except ClientError as e:
        print(f"DEBUG: ClientError - Code: {e.response['Error']['Code']}, Message: {e.response['Error']['Message']}")
        if e.response['Error']['Code'] == 'NoSuchKey':
            raise Exception(f"Questions file not found in S3: {S3_QUESTIONS_KEY}")
        elif e.response['Error']['Code'] == 'NoSuchBucket':
            raise Exception(f"S3 bucket not found: {S3_BUCKET}")
        else:
            raise Exception(f"S3 error: {str(e)}")
    except Exception as e:
        print(f"DEBUG: Unexpected error: {str(e)}")
        raise Exception(f"Error loading questions from S3: {str(e)}")

# Load questions at cold start from S3
QUESTIONS, TITLE = load_questions_from_s3()

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

def serve_questions():
    print(f"LOG: serve_questions() called - preparing {len(QUESTIONS)} questions for response")
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
    payload = {"title": TITLE, "questions": safe_questions}
    return build_response(200, payload)

def validate_submission(body_json):
    """
    Expecting:
    {
      "answers": { "<id>": "A" | "B" | "C" | "D" | "<option text>" , ... }
    }
    """
    print(f"LOG: validate_submission() called - starting quiz validation process")
    answers = body_json.get("answers", {})
    total = len(QUESTIONS)
    correct = 0
    per_question = []
    print(f"LOG: Processing {total} total questions with {len(answers)} submitted answers")

    # Build a lookup by id
    lookup = {q.get("id"): q for q in QUESTIONS}
    print(f"LOG: Built lookup table for {len(lookup)} questions by ID")

    for q in QUESTIONS:
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

        if method == "GET" and p == "/questions":
            print(f"LOG: Processing GET request for questions endpoint")
            return serve_questions()

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
            return validate_submission(body_json)

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
