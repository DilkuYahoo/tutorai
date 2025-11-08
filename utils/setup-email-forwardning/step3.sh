#!/bin/bash

# --- Configuration Constants ---
DOMAIN_NAME="cognifylabs.ai"
SES_REGION="us-east-1"
LAMBDA_FUNCTION_NAME="email-forwarder-lambda-function"
# The name for the SES Receipt Rule Set and the specific Rule
RULE_SET_NAME="${DOMAIN_NAME}-RuleSet"
RULE_NAME="InvokeLambdaFor${DOMAIN_NAME}"
# Role name for Lambda execution (adjust as necessary)
LAMBDA_EXECUTION_ROLE_NAME="email-forwarder-lambda-function-role"
# The ARN of your Lambda's code package (e.g., S3 URL or zip file path if using 'create-function')
# NOTE: Replace this with the actual ARN of your deployed Lambda function if you created it manually.
# For this script, we assume the Lambda is created first and we only need its name.

# --- 1. Get the ARN of the existing Lambda function ---
echo -e "\n[Lambda] Retrieving ARN for Lambda function: ${LAMBDA_FUNCTION_NAME}..."
LAMBDA_ARN=$(aws lambda get-function \
    --function-name "${LAMBDA_FUNCTION_NAME}" \
    --region "${SES_REGION}" \
    --query 'Configuration.FunctionArn' \
    --output text 2>/dev/null)

if [ -z "$LAMBDA_ARN" ]; then
    echo "Error: Lambda function '${LAMBDA_FUNCTION_NAME}' not found in ${SES_REGION}."
    echo "Please create the Lambda function first."
    exit 1
fi
echo "[Lambda] Function ARN: ${LAMBDA_ARN}"

# --- 2. Create or Get SES Receipt Rule Set ---
echo -e "\n[SES] Creating or verifying Receipt Rule Set: ${RULE_SET_NAME}..."
aws ses create-receipt-rule-set \
    --rule-set-name "${RULE_SET_NAME}" \
    --region "${SES_REGION}" 2>/dev/null

if [ $? -ne 0 ]; then
    # Assume it already exists and proceed
    echo "[SES] Receipt Rule Set exists or was successfully created."
else
    # Set the new rule set as active (optional, but standard practice)
    aws ses set-active-receipt-rule-set \
        --rule-set-name "${RULE_SET_NAME}" \
        --region "${SES_REGION}"
fi

# --- 3. Grant SES Permission to Invoke Lambda ---
echo -e "\n[Lambda] Granting SES permission to invoke Lambda..."

# The SourceAccount is the AWS account ID from which SES is running (i.e., your account ID)
# The SourceArn is the ARN of the SES Receipt Rule Set
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
SOURCE_ARN="arn:aws:ses:${SES_REGION}:${ACCOUNT_ID}:receipt-rule-set/${RULE_SET_NAME}"

aws lambda add-permission \
    --function-name "${LAMBDA_FUNCTION_NAME}" \
    --statement-id "SESInvokePermission" \
    --action "lambda:InvokeFunction" \
    --principal "ses.amazonaws.com" \
    --source-account "${ACCOUNT_ID}" \
    --source-arn "${SOURCE_ARN}" \
    --region "${SES_REGION}"

if [ $? -ne 0 ]; then
    echo "[Lambda] Permission already exists or an error occurred while adding permission."
else
    echo "[Lambda] Permission successfully granted."
fi

# --- 4. Create the SES Receipt Rule ---
# This rule applies to any recipient on the cognifylabs.ai domain and sends it to Lambda
echo -e "\n[SES] Creating/Updating Receipt Rule: ${RULE_NAME}..."

aws ses create-receipt-rule \
    --rule-set-name "${RULE_SET_NAME}" \
    --rule "{
        \"Name\": \"${RULE_NAME}\",
        \"Enabled\": true,
        \"ScanEnabled\": true,
        \"Recipients\": [\"${DOMAIN_NAME}\"],
        \"Actions\": [
            {
                \"S3Action\": {
                    \"BucketName\": \"cognifylabs-ai-emails\",
                    \"ObjectKeyPrefix\": \"emails/\"
                }
            },
            {
                \"LambdaAction\": {
                    \"FunctionArn\": \"${LAMBDA_ARN}\",
                    \"InvocationType\": \"Event\"
                }
            }
        ]
    }" \
    --region "${SES_REGION}"

if [ $? -ne 0 ]; then
    echo "Error: Failed to create/update SES Receipt Rule."
    exit 1
fi

echo -e "\n✅ SES Trigger Setup Complete!"
echo "Any email sent to *anything*@${DOMAIN_NAME} in ${SES_REGION} will now:"
echo "1. Be stored in the S3 bucket: 'cognifylabs-ai-emails' under the 'emails/' prefix."
echo "2. Trigger your Lambda function: ${LAMBDA_FUNCTION_NAME}."