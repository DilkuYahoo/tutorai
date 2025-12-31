# SES Email Receiving Setup

This directory contains scripts and configurations to set up AWS SES (Simple Email Service) for receiving emails, storing them in S3, and forwarding them via a Lambda function. It also includes a DynamoDB table for routing rules.

## Overview

The setup includes:
- **SES Receipt Rules**: Configures SES to receive emails for specified domains and store them in S3.
- **S3 Bucket**: Stores incoming emails with appropriate permissions.
- **Lambda Function**: Processes emails and forwards them based on routing rules.
- **DynamoDB Table**: Stores email routing configurations.
- **IAM Roles and Policies**: Grants necessary permissions for SES, Lambda, S3, and DynamoDB access.

## Prerequisites

- AWS CLI configured with appropriate permissions (SES, Lambda, IAM, S3, DynamoDB).
- Python 3.8+ with `boto3` and `botocore` installed (`pip install boto3 botocore`).
- Bash for running shell scripts.
- Access to modify DNS MX records for your domains.

## Configuration

### Main Configuration (ses-setup.py)

Edit the configuration variables at the top of `ses-setup.py`:

```python
AWS_REGION = "us-east-1"  # Must be us-east-1, us-west-2, or eu-west-1 for SES receiving
S3_BUCKET_NAME = "cognifylabs-emails"
S3_OBJECT_PREFIX = "cognifylabs.ai/"  # Folder prefix for stored emails

# SES Configuration
RULE_SET_NAME = "cognifylabs-rule"
RECEIPT_RULE_NAME = "cognifylabs-ai-rule"
RECIPIENT_DOMAINS = ["info@cognifylabs.ai","cognifylabs.ai","cognifylabs.com.au","info@cognifylabs.com.au"]  # Domains/emails to receive mail for

# Lambda Configuration
LAMBDA_FUNCTION_ARN = "arn:aws:lambda:us-east-1:724772096157:function:email-forwarder"
LAMBDA_FUNCTION_NAME = "email-forwarder"
LAMBDA_ROLE_NAME = "email-forwarder-lambda-function-role"

# Set to True if this rule set should be active
ACTIVATE_RULE_SET = True
```

### Lambda Configuration (lambda/deployment-config.json)

This file configures the Lambda function deployment. Key sections:

- **Environment Variables**: Configure email forwarding settings, S3 bucket, DynamoDB table, etc.
- **IAM Policies**: Defines permissions for the Lambda role (trust policy, managed policies, custom policies).

### Lambda Code (lambda/email-forwarder.py)

The Lambda function code that processes incoming emails. Modify this file to change forwarding logic.

### DynamoDB Table (lambda/create-dynamodb.sh)

Run this script to create the SES-EmailRouting table if it doesn't exist.

## Deployment

### Initial Setup

1. **Create DynamoDB Table**:
   ```bash
   cd lambda
   bash create-dynamodb.sh
   cd ..
   ```

2. **Update DNS MX Records**:
   Run the DNS update script:
   ```bash
   bash update-dns-mx.sh
   ```
   This sets up MX records pointing to SES for your domains.

3. **Deploy SES and Lambda Setup**:
   ```bash
   python ses-setup.py
   ```
   This creates all AWS resources: S3 bucket policy, IAM role, Lambda permissions, receipt rules, etc.

### Redeploying the Lambda Function

If you make changes to the Lambda code or configuration:

1. **Update Lambda Code**:
   ```bash
   cd lambda
   python deploy_lambda.py --action deploy
   cd ..
   ```

2. **Or use the wrapper script**:
   ```bash
   bash ses-lambda-deployment-wrapper.sh
   ```

## Making Changes

### Modifying the Setup Script (ses-setup.py)

- **Adding Domains**: Update `RECIPIENT_DOMAINS` list.
- **Changing S3 Bucket**: Modify `S3_BUCKET_NAME` and `S3_OBJECT_PREFIX`.
- **IAM Permissions**: Adjust policies in `get_lambda_execution_policy()` if needed.
- **Receipt Rules**: Modify the `rule` dictionary in `create_resources()`.

After changes, redeploy with `python ses-setup.py`.

### Modifying Lambda Function

1. Edit `lambda/email-forwarder.py`.
2. Update `lambda/deployment-config.json` if needed (e.g., environment variables).
3. Redeploy: `cd lambda && python deploy_lambda.py --action deploy`

### Updating Routing Rules

Routing rules are stored in DynamoDB. To add/modify rules:

- Use AWS Console or CLI to update the `SES-EmailRouting` table.
- Each item should have: `domain` (partition key), `forward_to`, `mail_sender`, `enabled`.

### DNS Changes

If adding new domains, update `RECIPIENT_DOMAINS` and run `bash update-dns-mx.sh` again.

### Adding a New Domain

To add a new domain for email receiving:

1. **Update ses-setup.py**:
   - Add the new domain(s) to the `RECIPIENT_DOMAINS` list.

2. **Update create-dynamodb.sh**:
   - Add a new `aws dynamodb put-item` command for the new domain with appropriate routing details (forward_to, mail_sender, etc.).

3. **Update DNS MX Records**:
   - Modify `update-dns-mx.sh` to set the correct `DOMAIN` and `HOSTED_ZONE_ID` for the new domain.
   - Run the script: `bash update-dns-mx.sh`

4. **Redeploy**:
   - Run `python ses-setup.py` to update SES receipt rules with the new domain.
   - If the DynamoDB table already exists, manually add the routing item or recreate the table.

## Cleanup and Destruction

To remove all resources:

```bash
python ses-setup.py --destroy
```

This will:
- Deactivate and delete SES receipt rules.
- Remove Lambda permissions.
- Delete the IAM role.
- Remove SES statements from S3 bucket policy.

Note: The Lambda function itself is not deleted (to preserve logs). Manually delete it via AWS Console if needed.

## Monitoring and Troubleshooting

### Check Deployment Status

```bash
cd lambda
python deploy_lambda.py --action status
```

### Common Issues

- **SES Region**: Ensure you're using a supported region for SES receiving.
- **DNS Propagation**: MX record changes may take time to propagate.
- **IAM Permissions**: Verify your AWS user has necessary permissions.
- **Lambda Errors**: Check CloudWatch logs for the Lambda function.
- **S3 Access**: Ensure the bucket exists and policies are correct.

### Logs

- Lambda logs: AWS CloudWatch > Log Groups > `/aws/lambda/email-forwarder`
- SES events: Check SES console for delivery status.

## File Structure

```
ses-setup/
├── ses-setup.py                 # Main setup script
├── ses-lambda-deployment-wrapper.sh  # Deployment wrapper
├── update-dns-mx.sh             # DNS MX record updater
├── lambda/
│   ├── deploy_lambda.py         # Lambda deployment script
│   ├── deployment-config.json   # Lambda configuration
│   ├── email-forwarder.py       # Lambda function code
│   └── create-dynamodb.sh       # DynamoDB table creator
└── README.md                    # This file
```

## Security Notes

- The IAM role created has minimal required permissions.
- S3 bucket policy restricts access to SES only.
- Lambda function should validate inputs to prevent abuse.
- Regularly rotate AWS credentials and review access logs.

## Support

For issues, check AWS documentation for SES, Lambda, and related services. Ensure all prerequisites are met before deployment.