#!/bin/bash

# Script to set up S3 bucket policy for SES email storage

# Configuration
BUCKET_NAME="cognifylabs-ai-emails"
SES_REGION="us-east-1"

echo "Setting up S3 bucket policy for SES email storage..."
echo "Bucket: ${BUCKET_NAME}"
echo "Region: ${SES_REGION}"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

if [ -z "$ACCOUNT_ID" ]; then
    echo "Error: Could not retrieve AWS account ID"
    exit 1
fi

echo "Account ID: ${ACCOUNT_ID}"

# Create the bucket policy JSON
POLICY_JSON=$(cat <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowSESPuts",
            "Effect": "Allow",
            "Principal": {
                "Service": "ses.amazonaws.com"
            },
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::${BUCKET_NAME}/emails/*",
            "Condition": {
                "StringEquals": {
                    "aws:Referer": "${ACCOUNT_ID}"
                }
            }
        }
    ]
}
EOF
)

echo "Applying bucket policy..."

# Apply the bucket policy
aws s3api put-bucket-policy \
    --bucket "${BUCKET_NAME}" \
    --policy "${POLICY_JSON}" \
    --region "${SES_REGION}"

if [ $? -eq 0 ]; then
    echo "✅ S3 bucket policy applied successfully!"
    echo "SES can now write emails to s3://${BUCKET_NAME}/emails/"
else
    echo "❌ Failed to apply S3 bucket policy"
    exit 1
fi
