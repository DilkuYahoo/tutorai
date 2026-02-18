#!/usr/bin/env python3
"""
Lambda Deployment Script for Auth Login User Info Function

This script deploys the Lambda function to AWS with proper configuration.

Usage:
    python deploy_lambda.py [--config deploy.config]

Requirements:
    - AWS CLI configured with appropriate credentials
    - boto3 installed
"""

import boto3
import json
import os
import sys
import zipfile
import tempfile
import argparse
import subprocess
from botocore.exceptions import ClientError
from datetime import datetime


class LambdaDeployer:
    def __init__(self, config_file='deploy.config', region='ap-southeast-2'):
        self.config = self.load_config(config_file)
        self.region = region
        self.lambda_client = boto3.client('lambda', region_name=region)
        self.iam_client = boto3.client('iam', region_name=region)
        self.sts_client = boto3.client('sts', region_name=region)
        
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
            # Default configuration
            config = {
                'FUNCTION_NAME': 'auth-login-user-info-lambda',
                'RUNTIME': 'python3.13',
                'HANDLER': 'user_info.lambda_handler',
                'TIMEOUT': '30',
                'MEMORY_SIZE': '128',
                'COGNITO_USER_POOL_ID': 'ap-southeast-2_XXXXXXXXX',
                'REGION': 'ap-southeast-2'
            }
            
        return config
    
    def get_account_id(self):
        """Get AWS account ID"""
        identity = self.sts_client.get_caller_identity()
        return identity['Account']
    
    def create_or_get_role(self):
        """Create IAM role for Lambda or get existing one"""
        role_name = f"{self.config['FUNCTION_NAME']}-role"
        
        try:
            # Check if role exists
            role = self.iam_client.get_role(RoleName=role_name)
            print(f"Using existing role: {role_name}")
            return role['Role']['Arn']
        except ClientError:
            pass
        
        # Create role
        trust_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"Service": "lambda.amazonaws.com"},
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        try:
            role = self.iam_client.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=json.dumps(trust_policy),
                Description=f"Execution role for {self.config['FUNCTION_NAME']}"
            )
            print(f"Created role: {role_name}")
            
            # Attach basic Lambda execution policy
            self.iam_client.attach_role_policy(
                RoleName=role_name,
                PolicyArn='arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            )
            
            # Wait for role to be available
            import time
            time.sleep(10)
            
            return role['Role']['Arn']
        except ClientError as e:
            print(f"Error creating role: {e}")
            raise
    
    def create_deployment_package(self):
        """Create Lambda deployment package (zip file)"""
        lambda_dir = os.path.join(os.path.dirname(__file__), '..', 'lambda')
        
        # Create temporary zip file
        temp_dir = tempfile.mkdtemp()
        zip_path = os.path.join(temp_dir, 'deployment.zip')
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add Lambda function code
            for file in os.listdir(lambda_dir):
                if file.endswith('.py'):
                    file_path = os.path.join(lambda_dir, file)
                    zipf.write(file_path, file)
                    print(f"Added {file} to deployment package")
        
        return zip_path
    
    def deploy_function(self):
        """Deploy or update Lambda function"""
        function_name = self.config['FUNCTION_NAME']
        runtime = self.config.get('RUNTIME', 'python3.13')
        handler = self.config.get('HANDLER', 'user_info.lambda_handler')
        timeout = int(self.config.get('TIMEOUT', 30))
        memory_size = int(self.config.get('MEMORY_SIZE', 128))
        
        # Get or create IAM role
        role_arn = self.create_or_get_role()
        
        # Create deployment package
        zip_path = self.create_deployment_package()
        
        # Environment variables (AWS_REGION is reserved, use REGION instead)
        environment_vars = {
            'COGNITO_USER_POOL_ID': self.config.get('COGNITO_USER_POOL_ID', ''),
            'REGION': self.config.get('REGION', self.region)
        }
        
        try:
            # Check if function exists
            self.lambda_client.get_function(FunctionName=function_name)
            
            # Update existing function
            print(f"Updating existing function: {function_name}")
            
            with open(zip_path, 'rb') as f:
                self.lambda_client.update_function_code(
                    FunctionName=function_name,
                    ZipFile=f.read()
                )
            
            # Update configuration
            self.lambda_client.update_function_configuration(
                FunctionName=function_name,
                Handler=handler,
                Timeout=timeout,
                MemorySize=memory_size,
                Environment={'Variables': environment_vars}
            )
            
            print(f"Function updated: {function_name}")
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                # Create new function
                print(f"Creating new function: {function_name}")
                
                with open(zip_path, 'rb') as f:
                    self.lambda_client.create_function(
                        FunctionName=function_name,
                        Runtime=runtime,
                        Role=role_arn,
                        Handler=handler,
                        Code={'ZipFile': f.read()},
                        Timeout=timeout,
                        MemorySize=memory_size,
                        Environment={'Variables': environment_vars},
                        Description='User info endpoint for Cognito login test'
                    )
                
                print(f"Function created: {function_name}")
            else:
                raise
        
        # Clean up
        os.remove(zip_path)
        os.rmdir(os.path.dirname(zip_path))
        
        # Get function ARN
        response = self.lambda_client.get_function(FunctionName=function_name)
        return response['Configuration']['FunctionArn']
    
    def deploy(self):
        """Main deployment function"""
        print("=" * 60)
        print("Deploying Auth Login Lambda Function")
        print("=" * 60)
        
        function_arn = self.deploy_function()
        
        print("\n" + "=" * 60)
        print("DEPLOYMENT COMPLETE")
        print("=" * 60)
        print(f"Function Name: {self.config['FUNCTION_NAME']}")
        print(f"Function ARN: {function_arn}")
        print(f"Runtime: {self.config.get('RUNTIME', 'python3.13')}")
        print(f"Handler: {self.config.get('HANDLER', 'user_info.lambda_handler')}")
        print("=" * 60)
        
        return function_arn


def main():
    parser = argparse.ArgumentParser(description='Deploy Auth Login Lambda Function')
    parser.add_argument('--config', default='deploy.config', help='Configuration file')
    parser.add_argument('--region', default='ap-southeast-2', help='AWS region')
    
    args = parser.parse_args()
    
    deployer = LambdaDeployer(args.config, args.region)
    deployer.deploy()


if __name__ == '__main__':
    main()
