#!/usr/bin/env python3
"""
AWS SES Email Receiving Setup Script
Sets up SES receipt rules to store incoming emails in S3 and invoke a Lambda.
Usage:
    python ses-setup.py          # Create resources
    python ses-setup.py --destroy # Remove all resources
"""

import argparse
import json
import time
import boto3
from botocore.exceptions import ClientError

# =============================================================================
# CONFIGURATION - Modify these values
# =============================================================================

AWS_REGION = "us-east-1"  # Must be us-east-1, us-west-2, or eu-west-1 for SES receiving
S3_BUCKET_NAME = "cognifylabs-emails"
S3_OBJECT_PREFIX = "cognifylabs.ai/"  # Folder prefix for stored emails

# SES Configuration
RULE_SET_NAME = "cognifylabs-rule"
RECEIPT_RULE_NAME = "cognifylabs-ai-rule"
RECIPIENT_DOMAINS = ["info@cognifylabs.ai","cognifylabs.ai","cognifylabs.com.au","info@cognifylabs.com.au","info@advicegenie.com.au","advicegenie.com.au","theceylonlens.com","ratescan.com.au"]  # Domains/emails to receive mail for

# Lambda Configuration
LAMBDA_FUNCTION_ARN = "arn:aws:lambda:us-east-1:724772096157:function:email-forwarder"
LAMBDA_FUNCTION_NAME = "email-forwarder"
LAMBDA_ROLE_NAME = "email-forwarder-lambda-function-role"

# Set to True if this rule set should be active
ACTIVATE_RULE_SET = True

# =============================================================================
# END CONFIGURATION
# =============================================================================


def get_clients():
    """Initialize AWS clients."""
    return {
        "ses": boto3.client("sesv2", region_name=AWS_REGION),
        "ses_v1": boto3.client("ses", region_name=AWS_REGION),
        "s3": boto3.client("s3", region_name=AWS_REGION),
        "sts": boto3.client("sts", region_name=AWS_REGION),
        "iam": boto3.client("iam", region_name=AWS_REGION),
        "lambda": boto3.client("lambda", region_name=AWS_REGION),
    }


def get_account_id(clients):
    """Get the AWS account ID."""
    return clients["sts"].get_caller_identity()["Account"]


def get_bucket_policy(account_id):
    """Generate the S3 bucket policy for SES."""
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllowSESPuts",
                "Effect": "Allow",
                "Principal": {"Service": "ses.amazonaws.com"},
                "Action": "s3:PutObject",
                "Resource": f"arn:aws:s3:::{S3_BUCKET_NAME}/{S3_OBJECT_PREFIX}*",
                "Condition": {
                    "StringEquals": {"AWS:SourceAccount": account_id},
                    "StringLike": {
                        "AWS:SourceArn": f"arn:aws:ses:{AWS_REGION}:{account_id}:receipt-rule-set/{RULE_SET_NAME}:receipt-rule/{RECEIPT_RULE_NAME}"
                    },
                },
            }
        ],
    }


def get_lambda_trust_policy():
    """Generate the trust policy for Lambda execution role."""
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "lambda.amazonaws.com"},
                "Action": "sts:AssumeRole",
            }
        ],
    }


def get_lambda_execution_policy(account_id):
    """Generate the execution policy for the Lambda role."""
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "CloudWatchLogs",
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents",
                ],
                "Resource": f"arn:aws:logs:{AWS_REGION}:{account_id}:log-group:/aws/lambda/{LAMBDA_FUNCTION_NAME}:*",
            },
            {
                "Sid": "S3ReadEmails",
                "Effect": "Allow",
                "Action": ["s3:GetObject"],
                "Resource": f"arn:aws:s3:::{S3_BUCKET_NAME}/{S3_OBJECT_PREFIX}*",
            },
            {
                "Sid": "SESSendEmail",
                "Effect": "Allow",
                "Action": [
                    "ses:SendEmail",
                    "ses:SendRawEmail",
                ],
                "Resource": "*",
            },
            {
                "Sid": "DynamoDBGetItem",
                "Effect": "Allow",
                "Action": ["dynamodb:GetItem"],
                "Resource": f"arn:aws:dynamodb:{AWS_REGION}:{account_id}:table/SES-EmailRouting",
            },
        ],
    }


def delete_role_completely(clients, role_name):
    """Delete an IAM role and all attached policies."""
    iam = clients["iam"]

    try:
        # Detach managed policies
        paginator = iam.get_paginator("list_attached_role_policies")
        for page in paginator.paginate(RoleName=role_name):
            for policy in page["AttachedPolicies"]:
                print(f"    Detaching managed policy: {policy['PolicyName']}")
                iam.detach_role_policy(RoleName=role_name, PolicyArn=policy["PolicyArn"])

        # Delete inline policies
        paginator = iam.get_paginator("list_role_policies")
        for page in paginator.paginate(RoleName=role_name):
            for policy_name in page["PolicyNames"]:
                print(f"    Deleting inline policy: {policy_name}")
                iam.delete_role_policy(RoleName=role_name, PolicyName=policy_name)

        # Delete the role
        iam.delete_role(RoleName=role_name)
        print(f"  ✓ Role '{role_name}' deleted")
        return True

    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchEntity":
            print(f"  ⓘ Role '{role_name}' does not exist")
            return False
        raise


def create_lambda_role(clients, account_id):
    """Create or recreate the Lambda execution role."""
    iam = clients["iam"]

    print(f"\n[2/6] Creating Lambda execution role '{LAMBDA_ROLE_NAME}'...")

    # Delete existing role if it exists
    try:
        iam.get_role(RoleName=LAMBDA_ROLE_NAME)
        print(f"  ⓘ Role exists, deleting and recreating...")
        delete_role_completely(clients, LAMBDA_ROLE_NAME)
        time.sleep(5)  # Wait for eventual consistency
    except ClientError as e:
        if e.response["Error"]["Code"] != "NoSuchEntity":
            raise

    # Create the role
    try:
        role_response = iam.create_role(
            RoleName=LAMBDA_ROLE_NAME,
            AssumeRolePolicyDocument=json.dumps(get_lambda_trust_policy()),
            Description="Execution role for SES email forwarder Lambda function",
            Tags=[
                {"Key": "ManagedBy", "Value": "ses-s3-setup-script"},
            ],
        )
        role_arn = role_response["Role"]["Arn"]
        print(f"  ✓ Role created: {role_arn}")
    except ClientError as e:
        print(f"  ✗ Failed to create role: {e}")
        raise

    # Attach inline policy
    print(f"  Adding execution policy...")
    iam.put_role_policy(
        RoleName=LAMBDA_ROLE_NAME,
        PolicyName="email-forwarder-execution-policy",
        PolicyDocument=json.dumps(get_lambda_execution_policy(account_id)),
    )
    print(f"  ✓ Execution policy attached")

    # Wait for role to propagate
    print(f"  Waiting for role to propagate...")
    time.sleep(10)

    return role_arn


def add_lambda_ses_permission(clients, account_id):
    """Add permission for SES to invoke the Lambda function."""
    lambda_client = clients["lambda"]

    statement_id = "AllowSESInvoke"

    print(f"\n[3/6] Adding SES invoke permission to Lambda...")

    # Remove existing permission if present
    try:
        lambda_client.remove_permission(
            FunctionName=LAMBDA_FUNCTION_NAME,
            StatementId=statement_id,
        )
        print(f"  ⓘ Removed existing permission")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            pass  # Permission doesn't exist, that's fine

    # Add permission for SES to invoke Lambda
    try:
        lambda_client.add_permission(
            FunctionName=LAMBDA_FUNCTION_NAME,
            StatementId=statement_id,
            Action="lambda:InvokeFunction",
            Principal="ses.amazonaws.com",
            SourceAccount=account_id,
            SourceArn=f"arn:aws:ses:{AWS_REGION}:{account_id}:receipt-rule-set/{RULE_SET_NAME}:receipt-rule/{RECEIPT_RULE_NAME}",
        )
        print(f"  ✓ SES invoke permission added to Lambda")
    except ClientError as e:
        print(f"  ✗ Failed to add permission: {e}")
        raise


def update_lambda_role(clients):
    """Update the Lambda function to use our role."""
    lambda_client = clients["lambda"]

    print(f"\n[4/6] Updating Lambda function role...")

    try:
        # Get role ARN
        iam = clients["iam"]
        role = iam.get_role(RoleName=LAMBDA_ROLE_NAME)
        role_arn = role["Role"]["Arn"]

        lambda_client.update_function_configuration(
            FunctionName=LAMBDA_FUNCTION_NAME,
            Role=role_arn,
        )
        print(f"  ✓ Lambda function updated to use role '{LAMBDA_ROLE_NAME}'")

        # Wait for update to complete
        print(f"  Waiting for Lambda update to complete...")
        waiter = lambda_client.get_waiter("function_updated_v2")
        waiter.wait(FunctionName=LAMBDA_FUNCTION_NAME)
        print(f"  ✓ Lambda function ready")

    except ClientError as e:
        print(f"  ✗ Failed to update Lambda: {e}")
        raise


def create_resources(clients):
    """Create all SES, S3, IAM, and Lambda resources."""
    ses = clients["ses_v1"]
    s3 = clients["s3"]
    account_id = get_account_id(clients)

    print("=" * 60)
    print("Creating SES Email Receiving Resources")
    print("=" * 60)

    # Step 1: Update S3 bucket policy
    print(f"\n[1/6] Updating S3 bucket policy for '{S3_BUCKET_NAME}'...")
    try:
        try:
            existing = s3.get_bucket_policy(Bucket=S3_BUCKET_NAME)
            existing_policy = json.loads(existing["Policy"])
            existing_policy["Statement"] = [
                s for s in existing_policy["Statement"] if s.get("Sid") != "AllowSESPuts"
            ]
            existing_policy["Statement"].append(get_bucket_policy(account_id)["Statement"][0])
            new_policy = existing_policy
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchBucketPolicy":
                new_policy = get_bucket_policy(account_id)
            else:
                raise

        s3.put_bucket_policy(Bucket=S3_BUCKET_NAME, Policy=json.dumps(new_policy))
        print(f"  ✓ Bucket policy updated")
    except ClientError as e:
        print(f"  ✗ Failed to update bucket policy: {e}")
        raise

    # Step 2: Create Lambda role
    create_lambda_role(clients, account_id)

    # Step 3: Add Lambda permission for SES
    add_lambda_ses_permission(clients, account_id)

    # Step 4: Update Lambda to use new role
    update_lambda_role(clients)

    # Step 5: Create receipt rule set and rule
    print(f"\n[5/6] Creating SES receipt rule set and rule...")
    try:
        ses.create_receipt_rule_set(RuleSetName=RULE_SET_NAME)
        print(f"  ✓ Rule set '{RULE_SET_NAME}' created")
    except ClientError as e:
        if e.response["Error"]["Code"] == "AlreadyExistsException":
            print(f"  ⓘ Rule set already exists, continuing...")
        else:
            raise

    # Create receipt rule with S3 and Lambda actions
    rule = {
        "Name": RECEIPT_RULE_NAME,
        "Enabled": True,
        "TlsPolicy": "Require",
        "Recipients": RECIPIENT_DOMAINS,
        "Actions": [
            {
                "S3Action": {
                    "BucketName": S3_BUCKET_NAME,
                    "ObjectKeyPrefix": S3_OBJECT_PREFIX,
                }
            },
            {
                "LambdaAction": {
                    "FunctionArn": LAMBDA_FUNCTION_ARN,
                    "InvocationType": "Event",  # Async invocation
                }
            },
        ],
        "ScanEnabled": True,
    }

    try:
        ses.create_receipt_rule(RuleSetName=RULE_SET_NAME, Rule=rule)
        print(f"  ✓ Receipt rule '{RECEIPT_RULE_NAME}' created")
    except ClientError as e:
        if e.response["Error"]["Code"] == "AlreadyExistsException":
            print(f"  ⓘ Rule already exists, updating...")
            ses.update_receipt_rule(RuleSetName=RULE_SET_NAME, Rule=rule)
            print(f"  ✓ Receipt rule updated")
        else:
            raise

    # Step 6: Activate rule set
    if ACTIVATE_RULE_SET:
        print(f"\n[6/6] Activating rule set '{RULE_SET_NAME}'...")
        try:
            ses.set_active_receipt_rule_set(RuleSetName=RULE_SET_NAME)
            print(f"  ✓ Rule set activated")
        except ClientError as e:
            print(f"  ✗ Failed to activate rule set: {e}")
            raise
    else:
        print(f"\n[6/6] Skipping rule set activation (ACTIVATE_RULE_SET=False)")

    print("\n" + "=" * 60)
    print("Setup Complete!")
    print("=" * 60)
    print(f"\nEmails to {RECIPIENT_DOMAINS} will be:")
    print(f"  1. Stored in: s3://{S3_BUCKET_NAME}/{S3_OBJECT_PREFIX}")
    print(f"  2. Forwarded by: {LAMBDA_FUNCTION_NAME}")


def destroy_resources(clients):
    """Remove all resources created by this script."""
    ses = clients["ses_v1"]
    s3 = clients["s3"]
    lambda_client = clients["lambda"]

    print("=" * 60)
    print("Destroying SES Email Receiving Resources")
    print("=" * 60)

    # Step 1: Deactivate rule set
    print(f"\n[1/6] Checking active rule set...")
    try:
        active = ses.describe_active_receipt_rule_set()
        if active.get("Metadata", {}).get("Name") == RULE_SET_NAME:
            ses.set_active_receipt_rule_set()
            print(f"  ✓ Rule set '{RULE_SET_NAME}' deactivated")
        else:
            print(f"  ⓘ Different rule set is active, skipping deactivation")
    except ClientError as e:
        if "RuleSetDoesNotExist" in str(e):
            print(f"  ⓘ No active rule set")
        else:
            print(f"  ⓘ No active rule set or error: {e}")

    # Step 2: Delete receipt rule
    print(f"\n[2/6] Deleting receipt rule '{RECEIPT_RULE_NAME}'...")
    try:
        ses.delete_receipt_rule(RuleSetName=RULE_SET_NAME, RuleName=RECEIPT_RULE_NAME)
        print(f"  ✓ Receipt rule deleted")
    except ClientError as e:
        if e.response["Error"]["Code"] in ["RuleDoesNotExist", "RuleSetDoesNotExistException"]:
            print(f"  ⓘ Rule does not exist, skipping...")
        else:
            print(f"  ⓘ Could not delete rule: {e}")

    # Step 3: Delete rule set
    print(f"\n[3/6] Deleting rule set '{RULE_SET_NAME}'...")
    try:
        ses.delete_receipt_rule_set(RuleSetName=RULE_SET_NAME)
        print(f"  ✓ Rule set deleted")
    except ClientError as e:
        if e.response["Error"]["Code"] == "RuleSetDoesNotExistException":
            print(f"  ⓘ Rule set does not exist, skipping...")
        else:
            print(f"  ⓘ Could not delete rule set: {e}")

    # Step 4: Remove Lambda SES permission
    print(f"\n[4/6] Removing SES permission from Lambda...")
    try:
        lambda_client.remove_permission(
            FunctionName=LAMBDA_FUNCTION_NAME,
            StatementId="AllowSESInvoke",
        )
        print(f"  ✓ SES permission removed from Lambda")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            print(f"  ⓘ Permission does not exist, skipping...")
        else:
            print(f"  ⓘ Could not remove permission: {e}")

    # Step 5: Delete Lambda role
    print(f"\n[5/6] Deleting Lambda role '{LAMBDA_ROLE_NAME}'...")
    delete_role_completely(clients, LAMBDA_ROLE_NAME)

    # Step 6: Remove SES statement from bucket policy
    print(f"\n[6/6] Removing SES statement from bucket policy...")
    try:
        existing = s3.get_bucket_policy(Bucket=S3_BUCKET_NAME)
        policy = json.loads(existing["Policy"])
        original_count = len(policy["Statement"])
        policy["Statement"] = [
            s for s in policy["Statement"] if s.get("Sid") != "AllowSESPuts"
        ]

        if len(policy["Statement"]) < original_count:
            if policy["Statement"]:
                s3.put_bucket_policy(Bucket=S3_BUCKET_NAME, Policy=json.dumps(policy))
                print(f"  ✓ SES statement removed from bucket policy")
            else:
                s3.delete_bucket_policy(Bucket=S3_BUCKET_NAME)
                print(f"  ✓ Bucket policy deleted (was empty after removal)")
        else:
            print(f"  ⓘ No SES statement found in bucket policy")
    except ClientError as e:
        if e.response["Error"]["Code"] == "NoSuchBucketPolicy":
            print(f"  ⓘ No bucket policy exists, skipping...")
        else:
            print(f"  ⓘ Could not update bucket policy: {e}")

    print("\n" + "=" * 60)
    print("Cleanup Complete!")
    print("=" * 60)
    print(f"\nNote: Lambda function '{LAMBDA_FUNCTION_NAME}' was NOT deleted.")
    print("      You may need to reassign a role to it manually.")


def main():
    parser = argparse.ArgumentParser(
        description="Setup or destroy SES email receiving to S3 with Lambda forwarding"
    )
    parser.add_argument(
        "--destroy",
        action="store_true",
        help="Destroy all resources created by this script",
    )
    args = parser.parse_args()

    clients = get_clients()

    if args.destroy:
        destroy_resources(clients)
    else:
        create_resources(clients)


if __name__ == "__main__":
    main()