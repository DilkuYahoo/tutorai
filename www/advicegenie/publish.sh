#!/bin/bash

# Variables
BUCKET_NAME="www.advicegenie.com.au"
REGION="ap-southeast-2" # Replace with your preferred AWS region
INDEX_FILE="index.html"
ERROR_FILE="index.html" # Set to a proper error file if needed
FOLDER_PATH="./" # Path to your website files (use . if files are in the current directory)
YOUR_DISTRIBUTION_ID="E1C5YSQD0KFMCM"
BA_PORTAL_DIST_PATH="../../app/ba-portal/dashboard-frontend/dist" # Path to ba-portal dist folder
BA_PREFIX="ba/" # Prefix for ba-portal content in S3


# Check if AWS CLI is installed
if ! [ -x "$(command -v aws)" ]; then
  echo "Error: AWS CLI is not installed. Install it from https://aws.amazon.com/cli/"
  exit 1
fi

set -e

# Check if bucket exists
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "Error: Bucket $BUCKET_NAME does not exist. Please create it first."
  exit 1
fi

echo "Bucket $BUCKET_NAME exists"

# Sync local folder with S3 bucket (root level)
echo "Uploading website files to S3 bucket"
aws s3 sync "$FOLDER_PATH" s3://"$BUCKET_NAME"/

# Check if ba-portal dist folder exists
if [ -d "$BA_PORTAL_DIST_PATH" ]; then
  echo "Found ba-portal dist folder at: $BA_PORTAL_DIST_PATH"
  
  # Sync ba-portal dist to S3 with ba/ prefix
  echo "Uploading ba-portal files to S3 bucket with prefix: $BA_PREFIX"
  aws s3 sync "$BA_PORTAL_DIST_PATH" s3://"$BUCKET_NAME"/"$BA_PREFIX" --delete
  
  if [ $? -ne 0 ]; then
    echo "Failed to upload ba-portal files to S3"
    exit 1
  fi
  
  echo "ba-portal files uploaded successfully to s3://$BUCKET_NAME/$BA_PREFIX"
else
  echo "Warning: ba-portal dist folder not found at: $BA_PORTAL_DIST_PATH"
  echo "Skipping ba-portal upload"
fi

# Output the website URL
echo "Website deployed successfully!"
echo "You can access the main website at: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo "You can access the ba-portal at: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com/$BA_PREFIX"

echo "Creating CloudFront invalidation for distribution: $YOUR_DISTRIBUTION_ID"
INVALIDATION_OUTPUT=$(aws cloudfront create-invalidation --distribution-id "$YOUR_DISTRIBUTION_ID" --paths "/*")

if [ $? -ne 0 ]; then
  echo "CloudFront invalidation failed."
  echo "$INVALIDATION_OUTPUT"
  exit 1
fi

echo "CloudFront invalidation created successfully."
echo "$INVALIDATION_OUTPUT"
