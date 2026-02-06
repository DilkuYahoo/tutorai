# Send Email Lambda

[![AWS](https://img.shields.io/badge/AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)

## Overview

Send Email Lambda is a serverless email sending service built on AWS Lambda and API Gateway. It provides a simple REST API endpoint to send emails via Amazon SES with optional attachment support.

Built on AWS serverless architecture, Send Email leverages Lambda for email processing and API Gateway for RESTful endpoints.

## Features

- **Simple Email Sending**: Send emails via Amazon SES with a single API call.
- **Email Attachments**: Support for PDF and DOCX attachments up to 50MB combined.
- **JSON API**: Accepts email parameters in JSON format via POST requests.
- **CORS Enabled**: Supports web-based access from any origin.
- **Config-Driven Deployment**: Automated setup using JSON configurations and Python scripts.

## Architecture

The application follows a serverless microservices architecture:

```mermaid
graph TD
    A[Client] --> B[API Gateway]
    B --> C[AWS Lambda]
    C --> D[Amazon SES]
```

- **API Gateway**: Handles HTTP requests and routes them to Lambda functions.
- **Lambda Function**: Processes email requests and sends via SES.
- **Amazon SES**: Handles email delivery.

## Tech Stack

- **Backend**: Python 3.13, AWS Lambda, AWS API Gateway
- **Email Service**: AWS SES
- **Deployment**: AWS CLI, boto3, Custom Python scripts

## Prerequisites

- AWS account with appropriate permissions (Lambda, API Gateway, SES, IAM).
- Python 3.13 or higher.
- AWS CLI configured with credentials.
- `boto3` library (`pip install boto3`).

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd app/send-email
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up AWS credentials:
   ```bash
   aws configure
   ```

## Usage

1. **Access the Application**:
   - Deploy to AWS and access via the API Gateway URL.
   - Send POST requests to the API endpoint with email parameters.

2. **API Endpoint**:
   - **POST /send-email**: Send an email.
     - Body: `{"sender": "from@example.com", "recipient": "to@example.com", "subject": "Subject", "body": "Message", "is_html": false, "attachments": [...]}`

## API Documentation

### Endpoints

- **POST /send-email**: Send an email.
  - Body: JSON with sender, recipient, subject, body, is_html (optional), attachments (optional)
  - Response: JSON with statusCode, messageId or error

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sender | string | Yes | Sender email address (verified in SES) |
| recipient | string | Yes | Recipient email address |
| subject | string | Yes | Email subject line |
| body | string | Yes | Email body content |
| is_html | boolean | No | Whether body contains HTML (default: false) |
| attachments | array | No | List of attachments (see below) |

### Attachment Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| filename | string | Yes | Name of the attachment file (e.g., "document.pdf") |
| content | string | Yes | Base64-encoded file content |
| content_type | string | No | MIME type (auto-detected from filename if not provided) |

### Attachment Specifications

- **Supported file types**: PDF (.pdf), DOCX (.docx)
- **Maximum combined attachment size**: 50MB
- **Individual file size**: Must not exceed 50MB

### Example Request with Attachment

```bash
curl -X POST https://your-api-url/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "sender": "test@example.com",
    "recipient": "recipient@example.com",
    "subject": "Test with Attachment",
    "body": "Please find the attached document.",
    "is_html": false,
    "attachments": [
      {
        "filename": "report.pdf",
        "content": "JVBERi0xLjQKJeLjz9MK...",
        "content_type": "application/pdf"
      }
    ]
  }'
```

### Authentication

- No explicit authentication; ensure proper AWS permissions.

## Deployment

1. **Deploy Lambda**:
   ```bash
   python deploy_lambda.py --config deploy.config
   ```

2. **Deploy API Gateway**:
   ```bash
   python deploy_api.py --config api-config.json --region us-east-1
   ```

3. **Update Lambda Code Only** (after code changes):
   ```bash
   python deploy_lamdba_code_only.py deploy.config
   ```

4. **Test**:
   ```bash
   # Simple email without attachment
   curl -X POST https://your-api-url/send-email \
     -H "Content-Type: application/json" \
     -d '{"sender":"test@example.com","recipient":"recipient@example.com","subject":"Test","body":"Hello","is_html":false}'

   # Email with attachment
   curl -X POST https://your-api-url/send-email \
     -H "Content-Type: application/json" \
     -d '{"sender":"test@example.com","recipient":"recipient@example.com","subject":"Test","body":"Hello with attachment","is_html":false,"attachments":[{"filename":"document.pdf","content":"BASE64_CONTENT","content_type":"application/pdf"}]}'
   ```

## Testing

- Manual testing via curl or Postman.
- Check CloudWatch logs for Lambda execution details.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make changes and test.
4. Submit a pull request.

## License

This project is licensed under the MIT License.

## Contact

For questions or support, contact [Your Name] at [email].
