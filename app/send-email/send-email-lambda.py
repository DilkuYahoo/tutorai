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
        "is_html": false
    }
"""

import json
import boto3                         # AWS SDK for Python
from botocore.exceptions import ClientError  # To handle AWS errors


def lambda_handler(event, context):
    """
    AWS Lambda handler to send an email via AWS SES.

    Expects JSON body from API Gateway POST request with parameters:
        sender (str): Verified sender email in SES
        recipient (str): Recipient email address
        subject (str): Email subject
        body (str): Email body content
        is_html (bool): True if the body is HTML, False for plain text (optional, defaults to False)
    """

    # Hardcoded AWS region
    aws_region = "ap-southeast-2"

    # Parse JSON body from API Gateway
    params = json.loads(event['body'])

    # Extract parameters from parsed JSON
    sender = params['sender']
    recipient = params['recipient']
    subject = params['subject']
    body = params['body']
    is_html = params.get('is_html', False)

    # Create a boto3 SES client in the hardcoded region
    ses_client = boto3.client("ses", region_name=aws_region)

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

    try:
        # Send the email via AWS SES
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