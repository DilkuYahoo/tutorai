"""
Send email using AWS SES as a Lambda function (parameterized & fully documented)

Requirements:
    boto3 (included in AWS Lambda runtime)

Usage:
    API Gateway POST request with JSON body:
    {
        "sender": "you@example.com",
        "recipient": "friend@example.com",
        "subject": "Test Email",
        "body": "Hello from AWS SES!",
        "is_html": false,
        "attachments": [
            {
                "filename": "document.pdf",
                "content": "base64-encoded-content...",
                "content_type": "application/pdf"
            }
        ]
    }

    Note: attachments is optional. Omit it to send emails without attachments.
    Supported attachment types: pdf, docx
    Maximum combined attachment size: 50MB
"""

import json
import boto3                         # AWS SDK for Python
import base64                        # For base64 encoding/decoding
import email.utils                   # For MIME message construction
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from botocore.exceptions import ClientError  # To handle AWS errors


# Configuration constants
MAX_ATTACHMENT_SIZE_MB = 50
MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024
SUPPORTED_CONTENT_TYPES = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}


def validate_attachments(attachments):
    """
    Validate attachment parameters.
    
    Args:
        attachments (list): List of attachment dictionaries
        
    Returns:
        tuple: (is_valid, error_message)
    """
    if not attachments:
        return True, None
    
    total_size = 0
    
    for idx, attachment in enumerate(attachments):
        # Check required fields
        if 'filename' not in attachment:
            return False, f"Attachment {idx} is missing 'filename' field"
        if 'content' not in attachment:
            return False, f"Attachment {idx} is missing 'content' field"
        
        filename = attachment['filename']
        content = attachment['content']
        
        # Validate file extension
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        if file_ext not in SUPPORTED_CONTENT_TYPES:
            return False, f"Unsupported file type: {filename}. Supported types: pdf, docx"
        
        # Calculate decoded content size
        try:
            decoded_content = base64.b64decode(content)
            content_size = len(decoded_content)
        except Exception:
            return False, f"Attachment {idx} has invalid base64 content"
        
        total_size += content_size
        
        # Check individual file size (using rough approximation)
        if content_size > MAX_ATTACHMENT_SIZE_BYTES:
            return False, f"Attachment {filename} exceeds {MAX_ATTACHMENT_SIZE_MB}MB limit"
    
    # Check total attachment size
    if total_size > MAX_ATTACHMENT_SIZE_BYTES:
        return False, f"Combined attachment size exceeds {MAX_ATTACHMENT_SIZE_MB}MB limit"
    
    return True, None


def create_attachment_part(attachment):
    """
    Create a MIME attachment part from an attachment dictionary.
    
    Args:
        attachment (dict): Attachment with 'filename', 'content', and optionally 'content_type'
        
    Returns:
        MIMEBase: MIME attachment part
    """
    filename = attachment['filename']
    content = attachment['content']
    
    # Determine content type from filename if not specified
    file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
    content_type = attachment.get('content_type', SUPPORTED_CONTENT_TYPES.get(file_ext, 'application/octet-stream'))
    
    # Decode base64 content
    decoded_content = base64.b64decode(content)
    
    # Create MIME part
    msg_attachment = MIMEBase(content_type.split('/')[0], content_type.split('/')[1])
    msg_attachment.set_payload(decoded_content)
    encoders.encode_base64(msg_attachment)
    
    # Add header with filename
    msg_attachment.add_header(
        'Content-Disposition',
        'attachment',
        filename=filename
    )
    
    return msg_attachment


def create_mime_message(sender, recipient, subject, body, is_html, attachments=None):
    """
    Create a MIME multipart message with optional attachments.
    
    Args:
        sender (str): Sender email address
        recipient (str): Recipient email address
        subject (str): Email subject
        body (str): Email body content
        is_html (bool): True if body is HTML, False for plain text
        attachments (list): Optional list of attachment dictionaries
        
    Returns:
        str: Raw MIME message as string
    """
    # Create multipart message
    msg = MIMEMultipart()
    msg['Subject'] = subject
    msg['From'] = sender
    msg['To'] = recipient
    
    # Add body
    if is_html:
        body_part = MIMEText(body, 'html')
    else:
        body_part = MIMEText(body, 'plain')
    msg.attach(body_part)
    
    # Add attachments if present
    if attachments:
        for attachment in attachments:
            attachment_part = create_attachment_part(attachment)
            msg.attach(attachment_part)
    
    return msg.as_string()


def lambda_handler(event, context):
    """
    AWS Lambda handler to send an email via AWS SES.

    Expects JSON body from API Gateway POST request with parameters:
        sender (str): Verified sender email in SES
        recipient (str): Recipient email address
        subject (str): Email subject
        body (str): Email body content
        is_html (bool): True if the body is HTML, False for plain text (optional, defaults to False)
        attachments (list): Optional list of attachment dictionaries (optional, defaults to None)
            Each attachment should have:
                - filename (str): Name of the file (e.g., "document.pdf")
                - content (str): Base64-encoded file content
                - content_type (str): MIME type (optional, auto-detected from filename)
    """

    # Hardcoded AWS region
    aws_region = "us-east-1"

    # Parse JSON body from API Gateway
    params = json.loads(event['body'])

    # Extract parameters from parsed JSON
    sender = params['sender']
    recipient = params['recipient']
    subject = params['subject']
    body = params['body']
    is_html = params.get('is_html', False)
    attachments = params.get('attachments', None)

    # Validate attachments if provided
    if attachments:
        is_valid, error_message = validate_attachments(attachments)
        if not is_valid:
            return {
                "statusCode": 400,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                },
                "body": json.dumps({
                    "error": error_message
                })
            }

    # Create a boto3 SES client in the hardcoded region
    ses_client = boto3.client("ses", region_name=aws_region)

    # Determine if we need raw email (for attachments) or simple email
    use_raw_email = attachments is not None and len(attachments) > 0

    try:
        if use_raw_email:
            # Use send_raw_email for messages with attachments (supports up to 50MB)
            raw_message = create_mime_message(sender, recipient, subject, body, is_html, attachments)
            
            response = ses_client.send_raw_email(
                Source=sender,
                Destinations=[recipient],
                RawMessage={'Data': raw_message.encode('utf-8')}
            )
        else:
            # Use send_email for simple messages without attachments (backward compatible)
            # Determine the content type
            if is_html:
                body_content = {"Html": {"Charset": "UTF-8", "Data": body}}
            else:
                body_content = {"Text": {"Charset": "UTF-8", "Data": body}}

            # Prepare the email payload
            email_payload = {
                "Source": sender,  # Verified sender
                "Destination": {"ToAddresses": [recipient]},
                "Message": {
                    "Subject": {"Charset": "UTF-8", "Data": subject},
                    "Body": body_content
                }
            }
            
            response = ses_client.send_email(**email_payload)

        # Return success response
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "messageId": response['MessageId'],
                "message": "Email sent successfully"
            })
        }

    except ClientError as e:
        # Return error response
        return {
            "statusCode": 500,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            "body": json.dumps({
                "error": e.response['Error']['Message']
            })
        }
