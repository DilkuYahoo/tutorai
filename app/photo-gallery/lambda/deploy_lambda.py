#!/usr/bin/env python3
"""
Deploy Photo Gallery Lambda Function
"""

import os
import json
import zipfile
import boto3
from botocore.exceptions import ClientError

# Configuration
FUNCTION_NAME = 'photo-gallery-api'
RUNTIME = 'python3.12'
HANDLER = 'main.lambda_handler'
TIMEOUT = 30
MEMORY_SIZE = 256

# Read config
def load_config():
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.yaml')
    import yaml
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

def create_deployment_package(lambda_dir, output_zip):
    """Create a deployment package (ZIP) for Lambda"""
    print(f"Creating deployment package: {output_zip}")
    
    with zipfile.ZipFile(output_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add main.py
        zipf.write(os.path.join(lambda_dir, 'main.py'), 'main.py')
        
        # Add requirements and install them
        requirements_path = os.path.join(lambda_dir, 'requirements.txt')
        if os.path.exists(requirements_path):
            zipf.write(requirements_path, 'requirements.txt')
    
    print(f"Deployment package created: {output_zip}")
    return output_zip

def deploy_lambda(function_name, zip_file, config):
    """Deploy or update the Lambda function"""
    lambda_client = boto3.client('lambda')
    
    # Get S3 bucket name from config
    s3_config = config.get('s3', {})
    bucket_name = s3_config.get('bucket_name', '')
    region = s3_config.get('region', 'ap-southeast-2')
    
    # Environment variables (only custom ones - Lambda uses default region)
    environment = {
        'Variables': {
            'S3_BUCKET_NAME': bucket_name
        }
    }
    
    # Read the ZIP file
    with open(zip_file, 'rb') as f:
        zip_content = f.read()
    
    try:
        # Try to update existing function
        print(f"Updating existing function: {function_name}")
        response = lambda_client.update_function_code(
            FunctionName=function_name,
            ZipFile=zip_content,
            Publish=True
        )
        print(f"Function updated: {response['FunctionArn']}")
        
        # Update configuration
        lambda_client.update_function_configuration(
            FunctionName=function_name,
            Handler=HANDLER,
            Runtime=RUNTIME,
            Timeout=TIMEOUT,
            MemorySize=MEMORY_SIZE,
            Environment=environment,
            Publish=True
        )
        print("Function configuration updated")
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        
        if error_code == 'ResourceNotFoundException':
            # Create new function
            print(f"Creating new function: {function_name}")
            try:
                # Get IAM role - in production, use a pre-created role
                iam_client = boto3.client('iam')
                role_arn = None
                
                # Try to get existing role
                try:
                    role = iam_client.get_role(RoleName='photo-gallery-lambda-role')
                    role_arn = role['Role']['Arn']
                except:
                    # Create role if it doesn't exist
                    print("Creating IAM role for Lambda...")
                    assume_role_policy = json.dumps({
                        "Version": "2012-10-17",
                        "Statement": [{
                            "Effect": "Allow",
                            "Principal": {"Service": "lambda.amazonaws.com"},
                            "Action": "sts:AssumeRole"
                        }]
                    })
                    role = iam_client.create_role(
                        RoleName='photo-gallery-lambda-role',
                        AssumeRolePolicyDocument=assume_role_policy
                    )
                    role_arn = role['Role']['Arn']
                    
                    # Attach basic execution policy
                    iam_client.attach_role_policy(
                        RoleName='photo-gallery-lambda-role',
                        PolicyArn='arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
                    )
                    
                    # Attach S3 read policy
                    s3_policy = json.dumps({
                        "Version": "2012-10-17",
                        "Statement": [{
                            "Effect": "Allow",
                            "Action": [
                                "s3:ListBucket",
                                "s3:GetObject"
                            ],
                            "Resource": [
                                f"arn:aws:s3:::{bucket_name}",
                                f"arn:aws:s3:::{bucket_name}/*"
                            ]
                        }]
                    })
                    iam_client.put_role_policy(
                        RoleName='photo-gallery-lambda-role',
                        PolicyName='photo-gallery-s3-read',
                        PolicyDocument=s3_policy
                    )
                    
                    print(f"Created IAM role: {role_arn}")
                
                response = lambda_client.create_function(
                    FunctionName=function_name,
                    Runtime=RUNTIME,
                    Role=role_arn,
                    Handler=HANDLER,
                    Code={'ZipFile': zip_content},
                    Timeout=TIMEOUT,
                    MemorySize=MEMORY_SIZE,
                    Environment=environment,
                    Publish=True
                )
                print(f"Function created: {response['FunctionArn']}")
                
            except ClientError as create_error:
                print(f"Error creating function: {create_error}")
                raise
        
        else:
            print(f"Error: {e}")
            raise
    
    return True


def main():
    """Main deployment function"""
    import yaml
    
    # Get directory paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    lambda_dir = script_dir
    project_dir = os.path.dirname(script_dir)
    
    # Load config
    config_path = os.path.join(project_dir, 'config.yaml')
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    print(f"Config loaded from: {config_path}")
    print(f"S3 Bucket: {config.get('s3', {}).get('bucket_name', 'NOT SET')}")
    
    # Create deployment package
    zip_file = os.path.join(lambda_dir, 'deployment_package.zip')
    create_deployment_package(lambda_dir, zip_file)
    
    # Deploy Lambda
    deploy_lambda(FUNCTION_NAME, zip_file, config)
    
    print("\n" + "="*50)
    print("Lambda deployment complete!")
    print(f"Function name: {FUNCTION_NAME}")
    print("="*50)


if __name__ == '__main__':
    main()
