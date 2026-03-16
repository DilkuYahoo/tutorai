#!/bin/bash
# ------------------------------
# Script to attach CloudFront function to route ba.advicegenie.com.au to /ba
# ------------------------------

# ------------------------------
# VARIABLES (EDIT THESE)
# ------------------------------
DIST_ID="E1C5YSQD0KFMCM"           # CloudFront distribution ID
FUNCTION_NAME="advicegenie-prefix-router"
FUNCTION_CODE_FILE="cf-prefix-router.js"  # JS file with function code
AWS_ACCOUNT_ID="724772096157"    # Your AWS Account ID
REGION="us-east-1"                  # CloudFront functions region
# ------------------------------

set -e  # Stop on error

echo "Step 1: Download current CloudFront distribution config..."
aws cloudfront get-distribution-config \
  --id "$DIST_ID" \
  --output json > cf-config.json

ETAG=$(jq -r '.ETag' cf-config.json)
jq '.DistributionConfig' cf-config.json > dist-config.json

echo "Step 2: Create CloudFront Function..."
FUNC_JSON=$(aws cloudfront create-function \
  --name "$FUNCTION_NAME" \
  --function-config Comment="AdviceGenie prefix router",Runtime=cloudfront-js-1.0 \
  --function-code fileb://"$FUNCTION_CODE_FILE")

FUNC_ETAG=$(echo "$FUNC_JSON" | jq -r '.ETag')
FUNC_ARN="arn:aws:cloudfront::$AWS_ACCOUNT_ID:function/$FUNCTION_NAME"

echo "Step 3: Publish CloudFront Function..."
aws cloudfront publish-function \
  --name "$FUNCTION_NAME" \
  --if-match "$FUNC_ETAG"

echo "Step 4: Attach Function to DefaultCacheBehavior..."

# Update the JSON: add or replace FunctionAssociations
jq --arg arn "$FUNC_ARN" '
  .DefaultCacheBehavior.FunctionAssociations = {
    "Quantity":1,
    "Items":[
      {
        "EventType":"viewer-request",
        "FunctionARN": $arn
      }
    ]
  }
' dist-config.json > dist-config-updated.json

echo "Step 5: Update distribution..."
aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config file://dist-config-updated.json

echo "Done! Distribution update in progress. This may take several minutes."