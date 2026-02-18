#!/usr/bin/env python3
"""
Teardown Script for Auth Login Lambda Function

This script removes all Lambda-related resources deployed by deploy_lambda.py.

Usage:
    python teardown_lambda.py [--config deploy.config] [--keep-role]

Resources removed:
    - Lambda function
    - IAM role (unless --keep-role is specified)
    - Attached IAM policies are detached before role deletion
"""

import boto3
import os
import sys
import argparse
from botocore.exceptions import ClientError


class LambdaTeardownManager:
    def __init__(self, config_file='deploy.config', region='ap-southeast-2'):
        self.config = self.load_config(config_file)
        self.region = region
        self.lambda_client = boto3.client('lambda', region_name=region)
        self.iam_client = boto3.client('iam', region_name=region)
        
    def load_config(self, config_file):
        """Load deployment configuration from file"""
        config = {}
        config_path = os.path.join(os.path.dirname(__file__), '..', 'lambda', config_file)
        
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        config[key.strip()] = value.strip()
        else:
            # Default configuration matching deploy.config
            config = {
                'FUNCTION_NAME': 'auth-login-user-info-lambda',
                'RUNTIME': 'python3.13',
                'HANDLER': 'user_info.lambda_handler',
                'TIMEOUT': '30',
                'MEMORY_SIZE': '128',
                'COGNITO_USER_POOL_ID': 'ap-southeast-2_GWzLKI17V',
                'REGION': 'ap-southeast-2'
            }
            print(f"Warning: Config file not found at {config_path}, using defaults")
            
        return config
    
    def get_function_name(self):
        """Get function name from config"""
        return self.config.get('FUNCTION_NAME', 'auth-login-user-info-lambda')
    
    def get_role_name(self):
        """Get role name based on function name"""
        return f"{self.get_function_name()}-role"
    
    def lambda_exists(self, function_name):
        """Check if Lambda function exists"""
        try:
            self.lambda_client.get_function(FunctionName=function_name)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                return False
            raise
    
    def role_exists(self, role_name):
        """Check if IAM role exists"""
        try:
            self.iam_client.get_role(RoleName=role_name)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchEntity':
                return False
            raise
    
    def delete_lambda_function(self):
        """Delete the Lambda function"""
        function_name = self.get_function_name()
        
        if not self.lambda_exists(function_name):
            print(f"Lambda function '{function_name}' not found, skipping deletion")
            return False
        
        try:
            # Get function details before deletion for confirmation
            response = self.lambda_client.get_function(FunctionName=function_name)
            function_arn = response['Configuration']['FunctionArn']
            
            # Delete the function
            self.lambda_client.delete_function(FunctionName=function_name)
            print(f"Deleted Lambda function: {function_name}")
            print(f"  ARN: {function_arn}")
            return True
            
        except ClientError as e:
            print(f"Error deleting Lambda function: {e}")
            return False
    
    def delete_iam_role(self):
        """Delete the IAM role and detach all policies"""
        role_name = self.get_role_name()
        
        if not self.role_exists(role_name):
            print(f"IAM role '{role_name}' not found, skipping deletion")
            return False
        
        try:
            # Detach all attached policies
            attached_policies = self.iam_client.list_attached_role_policies(RoleName=role_name)
            for policy in attached_policies.get('AttachedPolicies', []):
                self.iam_client.detach_role_policy(
                    RoleName=role_name,
                    PolicyArn=policy['PolicyArn']
                )
                print(f"  Detached policy: {policy['PolicyName']}")
            
            # Detach all inline policies
            inline_policies = self.iam_client.list_role_policies(RoleName=role_name)
            for policy_name in inline_policies.get('PolicyNames', []):
                self.iam_client.delete_role_policy(
                    RoleName=role_name,
                    PolicyName=policy_name
                )
                print(f"  Deleted inline policy: {policy_name}")
            
            # Delete the role
            self.iam_client.delete_role(RoleName=role_name)
            print(f"Deleted IAM role: {role_name}")
            return True
            
        except ClientError as e:
            print(f"Error deleting IAM role: {e}")
            return False
    
    def teardown(self, keep_role=False):
        """Run full teardown of Lambda resources"""
        function_name = self.get_function_name()
        role_name = self.get_role_name()
        
        print("=" * 60)
        print("Teardown Auth Login Lambda Resources")
        print("=" * 60)
        print(f"Function Name: {function_name}")
        print(f"Role Name: {role_name}")
        print(f"Region: {self.region}")
        print("=" * 60)
        
        # Delete Lambda function first (depends on role)
        print("\n[1/2] Deleting Lambda function...")
        lambda_deleted = self.delete_lambda_function()
        
        # Delete IAM role (unless --keep-role specified)
        if keep_role:
            print("\n[2/2] Keeping IAM role (--keep-role specified)")
        else:
            print("\n[2/2] Deleting IAM role...")
            self.delete_iam_role()
        
        print("\n" + "=" * 60)
        print("TEARDOWN COMPLETE")
        print("=" * 60)
        
        if lambda_deleted:
            print(f"✓ Lambda function '{function_name}' has been removed")
        else:
            print(f"○ Lambda function '{function_name}' was not found")
        
        if keep_role:
            print(f"○ IAM role '{role_name}' was preserved")
        elif self.role_exists(role_name):
            print(f"✗ IAM role '{role_name}' could not be deleted")
        else:
            print(f"✓ IAM role '{role_name}' has been removed")
        
        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Teardown Auth Login Lambda resources',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python teardown_lambda.py                    # Delete Lambda and IAM role
    python teardown_lambda.py --keep-role        # Delete Lambda only, keep IAM role
    python teardown_lambda.py --config custom.config  # Use custom config file
        """
    )
    parser.add_argument(
        '--config', 
        default='deploy.config', 
        help='Configuration file (default: deploy.config)'
    )
    parser.add_argument(
        '--keep-role', 
        action='store_true', 
        help='Keep the IAM role after deleting Lambda function'
    )
    parser.add_argument(
        '--region', 
        default='ap-southeast-2', 
        help='AWS region (default: ap-southeast-2)'
    )
    
    args = parser.parse_args()
    
    manager = LambdaTeardownManager(args.config, args.region)
    manager.teardown(keep_role=args.keep_role)


if __name__ == '__main__':
    main()
