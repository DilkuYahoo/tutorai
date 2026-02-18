#!/usr/bin/env python3
"""
Teardown Script for Auth Login API Gateway and Lambda

This script removes all deployed resources for the auth-login test page.

Usage:
    python teardown_api.py [--delete-lambda]
"""

import boto3
import argparse
from botocore.exceptions import ClientError


class TeardownManager:
    def __init__(self, region='ap-southeast-2'):
        self.region = region
        self.api_client = boto3.client('apigateway', region_name=region)
        self.lambda_client = boto3.client('lambda', region_name=region)
        self.iam_client = boto3.client('iam', region_name=region)
        
    def find_api(self, api_name):
        """Find API Gateway by name"""
        try:
            apis = self.api_client.get_rest_apis()
            for api in apis['items']:
                if api['name'] == api_name:
                    return api['id']
        except ClientError as e:
            print(f"Error finding API: {e}")
        return None
    
    def delete_api(self, api_name='auth-login-api-gateway'):
        """Delete API Gateway"""
        api_id = self.find_api(api_name)
        if api_id:
            try:
                self.api_client.delete_rest_api(restApiId=api_id)
                print(f"Deleted API Gateway: {api_name} (ID: {api_id})")
            except ClientError as e:
                print(f"Error deleting API: {e}")
        else:
            print(f"API Gateway '{api_name}' not found")
    
    def find_lambda(self, function_name):
        """Check if Lambda function exists"""
        try:
            self.lambda_client.get_function(FunctionName=function_name)
            return True
        except ClientError:
            return False
    
    def delete_lambda(self, function_name='auth-login-user-info-lambda'):
        """Delete Lambda function"""
        if self.find_lambda(function_name):
            try:
                self.lambda_client.delete_function(FunctionName=function_name)
                print(f"Deleted Lambda function: {function_name}")
            except ClientError as e:
                print(f"Error deleting Lambda: {e}")
        else:
            print(f"Lambda function '{function_name}' not found")
    
    def delete_role(self, function_name='auth-login-user-info-lambda'):
        """Delete IAM role for Lambda"""
        role_name = f"{function_name}-role"
        try:
            # Detach policies first
            attached_policies = self.iam_client.list_attached_role_policies(RoleName=role_name)
            for policy in attached_policies.get('AttachedPolicies', []):
                self.iam_client.detach_role_policy(
                    RoleName=role_name,
                    PolicyArn=policy['PolicyArn']
                )
                print(f"Detached policy: {policy['PolicyName']}")
            
            # Delete role
            self.iam_client.delete_role(RoleName=role_name)
            print(f"Deleted IAM role: {role_name}")
        except ClientError as e:
            if e.response['Error']['Code'] != 'NoSuchEntity':
                print(f"Error deleting role: {e}")
    
    def teardown(self, delete_lambda=False):
        """Run full teardown"""
        print("=" * 60)
        print("Teardown Auth Login Resources")
        print("=" * 60)
        
        # Delete API Gateway
        self.delete_api()
        
        if delete_lambda:
            # Delete Lambda function
            self.delete_lambda()
            
            # Delete IAM role
            self.delete_role()
        
        print("\n" + "=" * 60)
        print("TEARDOWN COMPLETE")
        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description='Teardown Auth Login resources')
    parser.add_argument('--delete-lambda', action='store_true', help='Also delete Lambda function and role')
    parser.add_argument('--region', default='ap-southeast-2', help='AWS region')
    
    args = parser.parse_args()
    
    manager = TeardownManager(args.region)
    manager.teardown(delete_lambda=args.delete_lambda)


if __name__ == '__main__':
    main()
