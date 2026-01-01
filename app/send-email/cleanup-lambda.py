#!/usr/bin/env python3
"""
Script to list all policies with access to invoke a specific Lambda function
"""

import boto3
import json
import argparse
import configparser
import os
from botocore.exceptions import ClientError

class LambdaPolicyInspector:
    def __init__(self, config_file='deploy.config'):
        self.config = self.load_config(config_file)
        self.function_name = self.config['function_name']
        self.region = self.config.get('region', 'us-east-1')
        self.lambda_client = boto3.client('lambda', region_name=self.region)

    def load_config(self, config_file):
        """Load configuration from file with defaults"""
        config = configparser.ConfigParser()

        # Default configuration
        defaults = {
            'function_name': 'sample-lambda-function',
            'region': 'ap-southeast-2',
        }

        if os.path.exists(config_file):
            config.read(config_file)
            if 'DEFAULT' in config:
                defaults.update(dict(config['DEFAULT']))

        return defaults

    def get_function_policy(self, function_name):
        """Get the resource-based policy for the Lambda function"""
        # First check if function exists
        try:
            self.lambda_client.get_function(FunctionName=function_name)
            print(f"✅ Function '{function_name}' exists in region {self.region}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                print(f"❌ Lambda function '{function_name}' not found in region {self.region}")
                return None
            else:
                print(f"❌ Error checking function existence: {e}")
                return None

        # Now try to get the policy
        try:
            response = self.lambda_client.get_policy(FunctionName=function_name)
            return response.get('Policy', '{}')
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                print(f"ℹ️  No resource-based policy found for '{function_name}' (this is normal for functions invoked only through API Gateway)")
                return None
            else:
                print(f"❌ Error retrieving policy: {e}")
                return None

    def parse_invoke_permissions(self, policy_document):
        """Parse the policy document and extract invoke permissions"""
        try:
            policy = json.loads(policy_document)
        except json.JSONDecodeError:
            print("Invalid policy document format")
            return []

        statements = policy.get('Statement', [])
        invoke_permissions = []

        for statement in statements:
            if statement.get('Effect') == 'Allow' and 'lambda:InvokeFunction' in statement.get('Action', []):
                principal = statement.get('Principal', {})
                source_arn = statement.get('Condition', {}).get('StringEquals', {}).get('AWS:SourceArn', 'Any')

                permission_info = {
                    'Principal': principal,
                    'SourceArn': source_arn,
                    'StatementId': statement.get('Sid', 'No ID')
                }
                invoke_permissions.append(permission_info)

        return invoke_permissions

    def list_invoke_permissions(self, function_name):
        """List all permissions that allow invocation of the Lambda function"""
        print(f"Checking invoke permissions for Lambda function: {function_name}")
        print(f"Using region: {self.region}")
        print(f"Config file: {self.config}")
        print("=" * 60)

        policy_document = self.get_function_policy(function_name)
        if policy_document is None:
            return

        permissions = self.parse_invoke_permissions(policy_document)

        if not permissions:
            print("No invoke permissions found in the policy")
            return

        print(f"Found {len(permissions)} invoke permission(s):")
        print()

        for i, perm in enumerate(permissions, 1):
            print(f"{i}. Principal: {perm['Principal']}")
            print(f"   Source ARN: {perm['SourceArn']}")
            print(f"   Statement ID: {perm['StatementId']}")
            print()

def main():
    parser = argparse.ArgumentParser(description='List invoke permissions for a Lambda function')
    parser.add_argument('--config', default='deploy.config', help='Configuration file path (default: deploy.config)')

    args = parser.parse_args()

    inspector = LambdaPolicyInspector(args.config)
    inspector.list_invoke_permissions(inspector.function_name)

if __name__ == '__main__':
    main()