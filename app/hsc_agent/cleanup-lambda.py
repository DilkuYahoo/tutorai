#!/usr/bin/env python3
"""
Script to list all policies with access to invoke a specific Lambda function
"""

import boto3
import json
import argparse
from botocore.exceptions import ClientError

class LambdaPolicyInspector:
    def __init__(self, region='ap-southeast-2'):
        self.region = region
        self.lambda_client = boto3.client('lambda', region_name=region)
        
    def get_function_policy(self, function_name):
        """Get the resource-based policy for the Lambda function"""
        try:
            response = self.lambda_client.get_policy(FunctionName=function_name)
            return response.get('Policy', '{}')
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                print(f"Lambda function '{function_name}' not found")
                return None
            elif e.response['Error']['Code'] == 'ResourceConflictException':
                print(f"No resource-based policy found for '{function_name}'")
                return None
            else:
                print(f"Error retrieving policy: {e}")
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
    parser.add_argument('--function-name', required=True, help='Name or ARN of the Lambda function')
    parser.add_argument('--region', default='ap-southeast-2', help='AWS region (default: ap-southeast-2)')
    
    args = parser.parse_args()
    
    inspector = LambdaPolicyInspector(args.region)
    inspector.list_invoke_permissions(args.function_name)

if __name__ == '__main__':
    main()
