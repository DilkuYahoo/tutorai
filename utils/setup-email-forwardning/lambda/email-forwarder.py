import os
import logging
import boto3
from email import message_from_bytes
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from botocore.exceptions import ClientError
from typing import Dict, Any

# Constants
FORWARD_PREFIX = "FW: "

# Environment variables
REGION = os.environ.get('Region')
MAIL_S3_BUCKET = os.environ.get('MailS3Bucket')
MAIL_S3_PREFIX = os.environ.get('MailS3Prefix')
MAIL_SENDER = os.environ.get('MailSender')
MAIL_RECIPIENT = os.environ.get('MailRecipient')

# Setup logging
logging.basicConfig(level=logging.INFO)

# Validate required environment variables
def validate_env_vars() -> None:
    """Validate that all required environment variables are set."""
    required_vars = ['Region', 'MailS3Bucket', 'MailSender', 'MailRecipient']
    for var in required_vars:
        if not os.environ.get(var):
            raise ValueError(f"Missing required environment variable: {var}")

validate_env_vars()

# Initialize AWS clients
s3_client = boto3.client("s3", region_name=REGION)
ses_client = boto3.client("ses", region_name=REGION)

def get_message_from_s3(message_id: str) -> Dict[str, Any]:
    """
    Retrieve the email message from S3.

    Args:
        message_id (str): The unique ID of the message.

    Returns:
        Dict[str, Any]: A dictionary containing the file content and HTTP path.

    Raises:
        ClientError: If there's an error accessing S3.
    """
    try:
        object_path = f"{MAIL_S3_PREFIX}/{message_id}" if MAIL_S3_PREFIX else message_id
        object_http_path = (
            f"http://s3.console.aws.amazon.com/s3/object/{MAIL_S3_BUCKET}/{object_path}?region={REGION}"
        )
        object_s3 = s3_client.get_object(Bucket=MAIL_S3_BUCKET, Key=object_path)
        file_content = object_s3['Body'].read()
        return {"file": file_content, "path": object_http_path}
    except ClientError as e:
        logging.error(f"Error retrieving message from S3: {e}")
        raise

def extract_body_content(mailobject) -> str:
    """
    Extract the HTML body content from the email message.

    Args:
        mailobject: The parsed email message object.

    Returns:
        str: The extracted body content.
    """
    for part in mailobject.walk():
        if part.get_content_type() == 'text/html':
            payload = part.get_payload(decode=True)
            if isinstance(payload, bytes):
                return payload.decode('utf-8', errors='ignore')
            return payload
    # Fallback to plain text payload if available
    payload = mailobject.get_payload(decode=True)
    if isinstance(payload, bytes):
        return payload.decode('utf-8', errors='ignore')
    return payload if isinstance(payload, str) else ""

def create_message(file_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a forwarded email message.

    Args:
        file_dict (Dict[str, Any]): Dictionary containing file content and path.

    Returns:
        Dict[str, Any]: The formatted message dictionary.
    """
    mailobject = message_from_bytes(file_dict['file'])
    subject_original = mailobject.get('Subject', '')
    subject = f"{FORWARD_PREFIX} {subject_original}"
    body_content = extract_body_content(mailobject)

    msg = MIMEMultipart()
    html_part = MIMEText(body_content, "html")
    msg.attach(html_part)
    msg['Subject'] = subject
    msg['From'] = MAIL_SENDER
    msg['To'] = MAIL_RECIPIENT

    return {
        "Source": MAIL_SENDER,
        "Destinations": [MAIL_RECIPIENT],  # List for consistency
        "Data": msg.as_string()
    }

def send_email(message: Dict[str, Any]) -> str:
    """
    Send the email via SES.

    Args:
        message (Dict[str, Any]): The message dictionary to send.

    Returns:
        str: Success or error message.
    """
    try:
        response = ses_client.send_raw_email(
            Source=message['Source'],
            Destinations=message['Destinations'],
            RawMessage={'Data': message['Data']}
        )
        return f"Email sent! Message ID: {response['MessageId']}"
    except ClientError as e:
        error_msg = e.response['Error']['Message']
        logging.error(f"Error sending email: {error_msg}")
        return f"Failed to send email: {error_msg}"

def lambda_handler(event: Dict[str, Any], context: Any) -> None:
    """
    AWS Lambda handler for processing SES email forwarding.

    Args:
        event (Dict[str, Any]): The Lambda event.
        context (Any): The Lambda context.
    """
    try:
        # Handle different event structures
        if 'Records' in event and len(event['Records']) > 0:
            # SES event structure
            message_id = event['Records'][0]['ses']['mail']['messageId']
        elif 'messageId' in event:
            # Direct message ID
            message_id = event['messageId']
        else:
            # Try to extract from various possible structures
            message_id = None
            if 'ses' in event and 'mail' in event['ses'] and 'messageId' in event['ses']['mail']:
                message_id = event['ses']['mail']['messageId']
            elif 'mail' in event and 'messageId' in event['mail']:
                message_id = event['mail']['messageId']

            if not message_id:
                raise ValueError("Unable to extract messageId from event")

        logging.info(f"Received message ID {message_id}")
        file_dict = get_message_from_s3(message_id)
        message = create_message(file_dict)
        result = send_email(message)
        logging.info(result)
    except (KeyError, IndexError, ValueError) as e:
        logging.error(f"Invalid event structure or missing messageId: {e}")
        raise
    except Exception as e:
        logging.error(f"Unexpected error in lambda_handler: {e}")
        raise
