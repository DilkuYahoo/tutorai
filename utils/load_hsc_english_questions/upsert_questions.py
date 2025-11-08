import json
import boto3
import uuid
import hashlib
import logging
import os
import re
from typing import Dict, List, Optional, Tuple, Any
from botocore.exceptions import ClientError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TextAssessmentGenerator:
    def __init__(self):
        # Load configuration from environment variables
        self.aws_region = os.getenv('AWS_REGION', 'ap-southeast-2')
        self.s3_bucket = os.getenv('S3_BUCKET', 'hsc-agent-bucket-2')
        self.dynamodb_table = os.getenv('DYNAMODB_TABLE', 'hsc_agent_questions_mapping')
        self.bedrock_model = os.getenv('BEDROCK_MODEL', 'apac.anthropic.claude-sonnet-4-20250514-v1:0')
        self.max_text_length = int(os.getenv('MAX_TEXT_LENGTH', '50000'))
        self.max_tokens = int(os.getenv('MAX_TOKENS', '2000'))

        # Initialize AWS clients
        try:
            self.bedrock_client = boto3.client('bedrock-runtime', region_name=self.aws_region)
            self.s3_client = boto3.client('s3', region_name=self.aws_region)
            self.dynamodb = boto3.resource('dynamodb', region_name=self.aws_region)
            self.mapping_table = self.dynamodb.Table(self.dynamodb_table)
            logger.info("AWS clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize AWS clients: {e}")
            raise
        
    def get_text_input(self) -> Optional[str]:
        """Get text input from user via file or direct input"""
        print("Choose input method:")
        print("1. Load from file")
        print("2. Enter text directly")

        choice = input("Enter choice (1 or 2): ").strip()

        if choice == "1":
            return self.load_text_from_file()
        else:
            return self.get_text_direct_input()

    def load_text_from_file(self) -> Optional[str]:
        """Load text from a file with validation"""
        filepath = input("Enter file path: ").strip()

        # Validate file path
        if not filepath or not os.path.exists(filepath):
            logger.error(f"File does not exist: {filepath}")
            return None

        # Check file size
        file_size = os.path.getsize(filepath)
        if file_size > self.max_text_length:
            logger.error(f"File too large: {file_size} bytes (max: {self.max_text_length})")
            return None

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                text = f.read()

            # Validate text length
            if len(text) > self.max_text_length:
                logger.error(f"Text too long: {len(text)} characters (max: {self.max_text_length})")
                return None

            if len(text.strip()) == 0:
                logger.error("File is empty")
                return None

            logger.info(f"Successfully loaded text from file: {len(text)} characters")
            return text
        except Exception as e:
            logger.error(f"Error reading file: {e}")
            return None

    def get_text_direct_input(self) -> Optional[str]:
        """Get text via direct input with validation"""
        print("Please enter the text (press Ctrl+D or Ctrl+Z then Enter when finished):")
        lines = []
        try:
            while True:
                line = input()
                lines.append(line)
        except EOFError:
            pass

        text = '\n'.join(lines)

        # Validate text length
        if len(text) > self.max_text_length:
            logger.error(f"Text too long: {len(text)} characters (max: {self.max_text_length})")
            return None

        if len(text.strip()) == 0:
            logger.error("No text entered")
            return None

        logger.info(f"Successfully received text input: {len(text)} characters")
        return text

    def get_text_metadata(self) -> Tuple[str, str]:
        """Get title and author from user with validation"""
        title = input("Enter the title of the text: ").strip()
        author = input("Enter the author of the text: ").strip()

        # Validate inputs
        if not title:
            title = "Untitled Text"
            logger.warning("No title provided, using default")
        if not author:
            author = "Unknown Author"
            logger.warning("No author provided, using default")

        # Sanitize inputs
        title = re.sub(r'[^\w\s\-.,!?\'"]', '', title)[:200]  # Limit length and remove special chars
        author = re.sub(r'[^\w\s\-.,]', '', author)[:100]

        return title, author

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        retry=retry_if_exception_type((ClientError, Exception))
    )
    def generate_band6_questions(self, text: str, title: str, author: str) -> List[Dict[str, Any]]:
        """Generate Band 6 level questions focused on human experiences with retry logic"""

        prompt = f"""
        Based on the following text, generate 10 Band 6 level comprehension questions focused on human experiences. The questions should require analytical thinking and interpretation.

        TEXT TITLE: {title}
        AUTHOR: {author}
        TEXT:
        {text}

        Generate exactly 10 questions in JSON format with this structure:
        {{
            "questions": [
                {{
                    "id": 1,
                    "question": "question text here",
                    "options": ["option1", "option2", "option3", "option4"],
                    "answer": "correct answer here"
                }}
            ]
        }}

        Requirements:
        - Questions must be Year 12, Advanced English Band 6 level (challenging, analytical)
        - Focus on themes of human experiences: identity, relationships, growth, memory, loss, love, belonging, cultural perspectives, etc.
        - Include literary devices analysis (if applicable)
        - Include thematic interpretation
        - Include tone and mood analysis
        - Include structural analysis (if applicable)
        - Make options plausible but distinct
        - Ensure answers are accurate based on the provided text
        """

        try:
            logger.info("Generating questions using Bedrock...")
            response = self.bedrock_client.invoke_model(
                modelId=self.bedrock_model,
                body=json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": self.max_tokens,
                    "messages": [{
                        "role": "user",
                        "content": prompt
                    }]
                })
            )

            response_body = json.loads(response['body'].read())
            questions_json = response_body['content'][0]['text']

            # More robust JSON extraction
            questions_data = self._extract_json_from_response(questions_json)

            if not questions_data or 'questions' not in questions_data:
                raise ValueError("Invalid response format from Bedrock")

            questions = questions_data['questions']

            # Validate questions structure
            self._validate_questions(questions)

            logger.info(f"Successfully generated {len(questions)} questions")
            return questions

        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            raise Exception("Failed to generate questions. Please check your AWS Bedrock configuration and try again.")

    def _extract_json_from_response(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Extract JSON from Bedrock response more robustly"""
        try:
            # Try to parse the entire response as JSON first
            return json.loads(response_text)
        except json.JSONDecodeError:
            pass

        # Look for JSON block in the response
        json_pattern = r'\{.*\}'
        match = re.search(json_pattern, response_text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        # Fallback to original method
        start_idx = response_text.find('{')
        end_idx = response_text.rfind('}') + 1
        if start_idx != -1 and end_idx > start_idx:
            try:
                json_str = response_text[start_idx:end_idx]
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass

        return None

    def _validate_questions(self, questions: List[Dict[str, Any]]) -> None:
        """Validate the structure of generated questions"""
        if not isinstance(questions, list) or len(questions) != 10:
            raise ValueError(f"Expected 10 questions, got {len(questions) if isinstance(questions, list) else 'non-list'}")

        required_fields = ['id', 'question', 'options', 'answer']
        for i, q in enumerate(questions):
            if not isinstance(q, dict):
                raise ValueError(f"Question {i+1} is not a dictionary")

            for field in required_fields:
                if field not in q:
                    raise ValueError(f"Question {i+1} missing required field: {field}")

            if not isinstance(q['options'], list) or len(q['options']) != 4:
                raise ValueError(f"Question {i+1} must have exactly 4 options")

            if q['answer'] not in q['options']:
                raise ValueError(f"Question {i+1} answer not in options")

    def generate_filename_hash(self) -> str:
        """Generate 8-character hash for filename using SHA-256"""
        return hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()[:8]

    def create_assessment_json(self, text: str, title: str, author: str) -> Tuple[str, Dict[str, Any]]:
        """Create the complete assessment JSON file with progress indicators"""

        logger.info("Generating Band 6 questions...")
        print("⏳ Generating questions using AI...")

        questions = self.generate_band6_questions(text, title, author)

        print("✅ Questions generated successfully!")

        # Create assessment structure
        assessment = {
            "title": f"{title} - Comprehension Questions (Band 6)",
            "author": author,
            "text": text,
            "questions": questions
        }

        # Generate filename and save
        filename_hash = self.generate_filename_hash()
        filename = f"{filename_hash}.json"

        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(assessment, f, indent=2, ensure_ascii=False)
            logger.info(f"Assessment saved to {filename}")
        except Exception as e:
            logger.error(f"Failed to save assessment file: {e}")
            raise

        return filename, assessment

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(ClientError)
    )
    def upload_to_s3(self, filename: str, bucket_name: str) -> Optional[str]:
        """Upload file to S3 bucket with retry logic"""
        s3_key = f"data/{filename}"
        try:
            print("⏳ Uploading to S3...")
            self.s3_client.upload_file(filename, bucket_name, s3_key)
            logger.info(f"Successfully uploaded {filename} to s3://{bucket_name}/{s3_key}")
            print("✅ Upload completed!")
            return s3_key
        except ClientError as e:
            logger.error(f"Error uploading to S3: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error uploading to S3: {e}")
            return None

    def get_next_stage(self, area: str) -> int:
        """Get the next stage number for a specific area from DynamoDB table"""
        try:
            # Query items with the specific area
            response = self.mapping_table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('area').eq(area),
                ProjectionExpression='#s',
                ExpressionAttributeNames={'#s': 'stage'}
            )

            if 'Items' in response and response['Items']:
                # Find the maximum stage for this area
                max_stage = max(int(item['stage']) for item in response['Items'])
                return max_stage + 1
            else:
                # No items found for this area, start with stage 1
                return 1

        except ClientError as e:
            logger.error(f"Error getting next stage for area '{area}': {e}")
            return 1
        except Exception as e:
            logger.error(f"Unexpected error getting next stage for area '{area}': {e}")
            return 1

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(ClientError)
    )
    def update_mapping_table(self, s3_location: str, area: str = "unseen_text", subject: str = "Advanced English", year: str = "12") -> bool:
        """Update the DynamoDB mapping table with retry logic"""
        try:
            print("⏳ Updating mapping table...")
            next_stage = self.get_next_stage(area)
            new_id = str(uuid.uuid4())

            item = {
                'id': new_id,
                'area': area,
                'location': s3_location,
                'stage': next_stage,
                'subject': subject,
                'year': year
            }

            self.mapping_table.put_item(Item=item)

            logger.info(f"Successfully added mapping for area '{area}': Stage {next_stage}, Location: {s3_location}")
            print(f"✅ Mapping table updated! Area: {area}, Stage: {next_stage}")
            return True

        except ClientError as e:
            logger.error(f"Error updating mapping table: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error updating mapping table: {e}")
            return False

def setup_user_input(generator: TextAssessmentGenerator) -> Optional[Tuple[str, str, str]]:
    """Handle user input collection with proper error handling"""
    try:
        print("🎓 HSC English Text Assessment Generator")
        print("=" * 50)

        text = generator.get_text_input()
        if not text:
            logger.error("No text provided")
            return None

        title, author = generator.get_text_metadata()

        print(f"\n📄 Text received: {len(text)} characters")
        print(f"📖 Title: {title}")
        print(f"👤 Author: {author}")

        return text, title, author

    except KeyboardInterrupt:
        print("\n⚠️  Process interrupted by user.")
        return None
    except Exception as e:
        logger.error(f"Error during input collection: {e}")
        return None

def process_assessment(generator: TextAssessmentGenerator, text: str, title: str, author: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Process the assessment creation with progress indicators"""
    try:
        # Create assessment
        filename, assessment = generator.create_assessment_json(text, title, author)
        print(f"📁 Created assessment file: {filename}")

        # Upload to S3
        s3_location = generator.upload_to_s3(filename, generator.s3_bucket)

        if not s3_location:
            logger.error("Failed to upload to S3")
            return None

        # Update mapping table
        success = generator.update_mapping_table(s3_location)

        if not success:
            logger.warning("Mapping table update failed, but process continues")

        return filename, assessment

    except Exception as e:
        logger.error(f"Error during assessment processing: {e}")
        return None

def cleanup_temp_files(filename: str) -> None:
    """Clean up temporary files"""
    try:
        if os.path.exists(filename):
            os.remove(filename)
            logger.info(f"Cleaned up temporary file: {filename}")
    except Exception as e:
        logger.warning(f"Failed to clean up {filename}: {e}")

def print_final_summary(filename: str, assessment: Dict[str, Any], success: bool) -> None:
    """Print final summary of the process"""
    print(f"\n📊 Final Summary:")
    print(f"   📁 Filename: {filename}")
    print(f"   📖 Title: {assessment['title']}")
    print(f"   ❓ Questions: {len(assessment['questions'])} Band 6 questions")
    print(f"   🎯 Theme Focus: Human Experiences")
    print(f"   🗄️  DynamoDB Table: {assessment.get('dynamodb_table', 'hsc_agent_questions_mapping')}")
    print(f"   🪣 S3 Bucket: {assessment.get('s3_bucket', 'configured bucket')}")
    print(f"   ✅ Status: {'Success' if success else 'Completed with warnings'}")

def main() -> None:
    """Main function with improved error handling and structure"""
    # Initialize generator
    try:
        generator = TextAssessmentGenerator()
    except Exception as e:
        logger.error(f"Failed to initialize generator: {e}")
        return

    temp_filename = None

    try:
        # Get user input
        input_data = setup_user_input(generator)
        if not input_data:
            return

        text, title, author = input_data

        # Process assessment
        result = process_assessment(generator, text, title, author)
        if not result:
            print("❌ Process failed during assessment creation")
            return

        filename, assessment = result
        temp_filename = filename

        # Print final summary
        print_final_summary(filename, assessment, True)

    except KeyboardInterrupt:
        print("\n⚠️  Process interrupted by user.")
    except Exception as e:
        logger.error(f"Unexpected error in main: {e}")
        print(f"❌ An unexpected error occurred: {e}")
    finally:
        # Cleanup
        if temp_filename:
            cleanup_temp_files(temp_filename)

if __name__ == "__main__":
    # Check for required dependencies
    try:
        import tenacity
    except ImportError:
        print("❌ Missing required dependency: tenacity")
        print("Install with: pip install tenacity")
        exit(1)

    main()