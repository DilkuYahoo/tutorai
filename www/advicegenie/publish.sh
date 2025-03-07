#!/bin/bash

# Variables
BUCKET_NAME="www.advicegenie.com.au"
REGION="ap-southeast-2" # Replace with your preferred AWS region
INDEX_FILE="index.html"
ERROR_FILE="index.html" # Set to a proper error file if needed
FOLDER_PATH="./" # Path to your website files (use . if files are in the current directory)
YOUR_DISTRIBUTION_ID="E1C5YSQD0KFMCM"


# Check if AWS CLI is installed
if ! [ -x "$(command -v aws)" ]; then
  echo "Error: AWS CLI is not installed. Install it from https://aws.amazon.com/cli/"
  exit 1
fi

# Create S3 bucket if it doesn't exist
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "Bucket $BUCKET_NAME already exists"
else
  echo "Creating S3 bucket: $BUCKET_NAME"
  aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$REGION" --create-bucket-configuration LocationConstraint="$REGION"
  
  if [ $? -ne 0 ]; then
    echo "Failed to create S3 bucket"
    exit 1
  fi
fi

# Configure S3 bucket for website hosting
echo "Configuring S3 bucket for static website hosting"
aws s3 website s3://"$BUCKET_NAME"/ --index-document "$INDEX_FILE" --error-document "$ERROR_FILE"

# Sync local folder with S3 bucket
echo "Uploading website files to S3 bucket"
aws s3 sync "$FOLDER_PATH" s3://"$BUCKET_NAME"/

if [ $? -ne 0 ]; then
  echo "Failed to upload files to S3"
  exit 1
fi

# Output the website URL
echo "Website deployed successfully!"
echo "You can access the website at: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"

aws cloudfront create-invalidation --distribution-id $YOUR_DISTRIBUTION_ID --paths "/index.html" "/*"