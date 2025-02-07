#!/bin/bash

API_URL="https://n54lm5igkl.execute-api.ap-southeast-2.amazonaws.com/dev/send-email"

# File to attach
ATTACHMENT_PATH="/"
BASE64_ATTACHMENT=$(base64 "$ATTACHMENT_PATH")

# HTML email body
HTML_BODY="""
<html>
<head>
  <title>Test Email</title>
</head>
<body>
  <h1>Hello,</h1>
  <p>This is a <strong>test email</strong> from a Bash script with an attachment.</p>
</body>
</html>
"""

# JSON payload
read -r -d '' PAYLOAD <<EOF
{
  "sender": "info@advicegenie.com.au",
  "recipient": "dilku@yahoo.com",
  "subject": "Test Email with Attachment",
  "body": "$HTML_BODY",
  "content_type": "text/html",
  "attachment": {
    "filename": "download.pdf",
    "content": "$BASE64_ATTACHMENT",
    "content_type": "application/pdf"
  }
}
EOF

# Send request using curl
RESPONSE=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

# Print response
echo "Response: $RESPONSE"

# Check for success in response
if echo "$RESPONSE" | grep -q "success"; then
    echo "Email sent successfully with attachment!"
    exit 0
else
    echo "Failed to send email."
    exit 1
fi

