#!/usr/bin/env python3
"""
AWS Lambda Deployment Script with JSON parsing fix
"""

import boto3
import os
import zipfile
import json
import argparse
import configparser
import sys
import time
from botocore.exceptions import ClientError, NoCredentialsError, ParamValidationError

class LambdaDeployer:
    def __init__(self, config_file='deploy.config'):
        self.config = self.load_config(config_file)
        self.function_name = self.config['function_name']
        self.region = self.config.get('region', 'us-east-1')
        self.cleanup_files = []
        
        # Initialize clients only when needed
        self.lambda_client = None
        self.iam_client = None
        self.sts_client = None
        
    def load_config(self, config_file):
        """Load configuration from file with defaults"""
        config = configparser.ConfigParser()
        
        # Default configuration
        defaults = {
            'function_name': 'sample-lambda-function',
            'region': 'us-east-1',
            'runtime': 'python3.9',
            'handler': 'sample.lambda_handler',
            'memory': '128',
            'timeout': '30',
            'role_name': '',
            'script_path': 'sample.py',
            'requirements_file': 'requirements.txt',
            'layers': '',
            'layer_arns': '',
            's3_bucket': 'hsc-agent-bucket-2'
        }
        
        if os.path.exists(config_file):
            config.read(config_file)
            if 'DEFAULT' in config:
                defaults.update(dict(config['DEFAULT']))
        
        return defaults
    
    def get_client(self, service_name):
        """Lazy initialization of AWS clients"""
        try:
            if service_name == 'lambda' and not self.lambda_client:
                self.lambda_client = boto3.client(service_name, region_name=self.region)
            elif service_name == 'iam' and not self.iam_client:
                self.iam_client = boto3.client(service_name, region_name=self.region)
            elif service_name == 'sts' and not self.sts_client:
                self.sts_client = boto3.client(service_name, region_name=self.region)
            return True
        except (NoCredentialsError, ClientError) as e:
            print(f"Error initializing {service_name} client: {e}")
            return False
    
    def cleanup(self):
        """Clean up any temporary files created during deployment"""
        for file_path in self.cleanup_files:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"Cleaned up: {file_path}")
            except Exception as e:
                print(f"Warning: Could not clean up {file_path}: {e}")
    
    def get_layer_arns(self):
        """Get layer ARNs from configuration"""
        layer_arns = []
        
        configured_layers = self.config.get('layers', '') or self.config.get('layer_arns', '')
        
        if configured_layers:
            for layer_arn in configured_layers.split(','):
                layer_arn = layer_arn.strip()
                if layer_arn:
                    if layer_arn.startswith('arn:aws:lambda:') and ':layer:' in layer_arn:
                        layer_arns.append(layer_arn)
                    else:
                        print(f"Warning: Invalid layer ARN format: {layer_arn}")
        
        return layer_arns
    
    def verify_layers_exist(self, layer_arns):
        """Verify that the specified layers exist in AWS"""
        if not layer_arns:
            return True
            
        if not self.get_client('lambda'):
            return False
            
        missing_layers = []
        
        for layer_arn in layer_arns:
            try:
                if ':' in layer_arn:
                    layer_name = layer_arn.split(':')[-2]
                    version = layer_arn.split(':')[-1] if layer_arn.split(':')[-1].isdigit() else None
                    
                    if version:
                        self.lambda_client.get_layer_version(
                            LayerName=layer_name,
                            VersionNumber=int(version)
                        )
                    else:
                        response = self.lambda_client.list_layer_versions(
                            LayerName=layer_name,
                            MaxItems=1
                        )
                        if not response['LayerVersions']:
                            missing_layers.append(layer_arn)
                            continue
                    
                    print(f"✅ Verified layer exists: {layer_arn}")
                    
                else:
                    missing_layers.append(layer_arn)
                    
            except ClientError as e:
                if e.response['Error']['Code'] == 'ResourceNotFoundException':
                    missing_layers.append(layer_arn)
                else:
                    print(f"Error verifying layer {layer_arn}: {e}")
                    missing_layers.append(layer_arn)
        
        if missing_layers:
            print(f"❌ The following layers were not found:")
            for missing in missing_layers:
                print(f"   - {missing}")
            return False
        
        return True
    
    def create_deployment_package(self):
        """Create a zip deployment package for the function"""
        script_paths = [path.strip() for path in self.config['script_path'].split(',')]
        
        for path in script_paths:
            if not os.path.exists(path):
                raise FileNotFoundError(f"Script file {path} not found")
        
        package_name = f'{self.function_name}_deployment_package.zip'
        self.cleanup_files.append(package_name)
        
        try:
            with zipfile.ZipFile(package_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add the specified script files
                for path in script_paths:
                    zipf.write(path, os.path.basename(path))
            
            print(f"Created deployment package: {package_name}")
            return package_name
            
        except Exception as e:
            self.cleanup()
            raise Exception(f"Failed to create deployment package: {e}")
    
    def get_account_id(self):
        """Get AWS account ID"""
        if not self.get_client('sts'):
            return None
        
        try:
            identity = self.sts_client.get_caller_identity()
            return identity['Account']
        except ClientError as e:
            print(f"Error getting account ID: {e}")
            return None
    
    def attach_s3_policy(self, role_name):
        """Attach S3 access policy to the IAM role"""
        if not self.get_client('iam'):
            return False
        
        account_id = self.get_account_id()
        if not account_id:
            print("❌ Could not get AWS account ID for S3 policy")
            return False
        
        s3_bucket = self.config.get('s3_bucket', 'hsc-agent-bucket-2')
        
        # Custom policy for S3 access
        s3_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "s3:GetObject"
                    ],
                    "Resource": f"arn:aws:s3:::{s3_bucket}/*"
                }
            ]
        }
        
        policy_name = f"{role_name}-s3-policy"
        
        try:
            # Check if policy already exists
            try:
                self.iam_client.get_policy(PolicyArn=f"arn:aws:iam::{account_id}:policy/{policy_name}")
                print(f"S3 policy {policy_name} already exists")
            except ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchEntity':
                    # Create the policy
                    print(f"Creating S3 policy: {policy_name}")
                    policy_response = self.iam_client.create_policy(
                        PolicyName=policy_name,
                        PolicyDocument=json.dumps(s3_policy),
                        Description=f'S3 access policy for {role_name}'
                    )
                    print(f"✅ Created S3 policy: {policy_response['Policy']['Arn']}")
                else:
                    print(f"❌ Error checking S3 policy: {e}")
                    return False
            
            # Attach the policy to the role
            print(f"Attaching S3 policy to role: {role_name}")
            try:
                self.iam_client.attach_role_policy(
                    RoleName=role_name,
                    PolicyArn=f"arn:aws:iam::{account_id}:policy/{policy_name}"
                )
                print(f"✅ Attached S3 policy to role: {role_name}")
                return True
            except ClientError as e:
                if e.response['Error']['Code'] == 'PolicyAlreadyAttached':
                    print(f"S3 policy already attached to role: {role_name}")
                    return True
                else:
                    print(f"❌ Error attaching S3 policy: {e}")
                    return False
            
        except ClientError as e:
            print(f"❌ Error attaching S3 policy: {e}")
            return False
    
    def attach_dynamodb_policy(self, role_name):
        """Attach DynamoDB access policy to the IAM role"""
        if not self.get_client('iam'):
            return False
        
        account_id = self.get_account_id()
        if not account_id:
            print("❌ Could not get AWS account ID for DynamoDB policy")
            return False
        
        # Custom policy for DynamoDB access
        dynamodb_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [
                        "dynamodb:PutItem"
                    ],
                    "Resource": "arn:aws:dynamodb:ap-southeast-2:*:table/hsc_agent_quiz_attempts"
                }
            ]
        }
        
        policy_name = f"{role_name}-dynamodb-policy"
        
        try:
            # Check if policy already exists
            try:
                self.iam_client.get_policy(PolicyArn=f"arn:aws:iam::{account_id}:policy/{policy_name}")
                print(f"DynamoDB policy {policy_name} already exists")
            except ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchEntity':
                    # Create the policy
                    print(f"Creating DynamoDB policy: {policy_name}")
                    policy_response = self.iam_client.create_policy(
                        PolicyName=policy_name,
                        PolicyDocument=json.dumps(dynamodb_policy),
                        Description=f'DynamoDB access policy for {role_name}'
                    )
                    print(f"✅ Created DynamoDB policy: {policy_response['Policy']['Arn']}")
                else:
                    print(f"❌ Error checking DynamoDB policy: {e}")
                    return False
            
            # Attach the policy to the role
            print(f"Attaching DynamoDB policy to role: {role_name}")
            try:
                self.iam_client.attach_role_policy(
                    RoleName=role_name,
                    PolicyArn=f"arn:aws:iam::{account_id}:policy/{policy_name}"
                )
                print(f"✅ Attached DynamoDB policy to role: {role_name}")
                return True
            except ClientError as e:
                if e.response['Error']['Code'] == 'PolicyAlreadyAttached':
                    print(f"DynamoDB policy already attached to role: {role_name}")
                    return True
                else:
                    print(f"❌ Error attaching DynamoDB policy: {e}")
                    return False
            
        except ClientError as e:
            print(f"❌ Error attaching DynamoDB policy: {e}")
            return False
    
    def create_iam_role(self):
        """Create IAM role for Lambda function"""
        role_name = self.config.get('role_name') or f'{self.function_name}-lambda-role'
        
        if not self.get_client('iam'):
            return None
        
        # Proper trust policy that allows Lambda service to assume the role
        trust_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "lambda.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        try:
            # Check if role already exists
            try:
                existing_role = self.iam_client.get_role(RoleName=role_name)
                print(f"IAM role {role_name} already exists")
                role_arn = existing_role['Role']['Arn']
            except ClientError as e:
                if e.response['Error']['Code'] == 'NoSuchEntity':
                    # Role doesn't exist, create it
                    print(f"Creating IAM role: {role_name}")
                    role_response = self.iam_client.create_role(
                        RoleName=role_name,
                        AssumeRolePolicyDocument=json.dumps(trust_policy),
                        Description=f'IAM role for {self.function_name} Lambda function'
                    )
                    
                    # Attach basic execution policy
                    print("Attaching execution policy to role...")
                    self.iam_client.attach_role_policy(
                        RoleName=role_name,
                        PolicyArn='arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
                    )
                    
                    print(f"✅ Created IAM role: {role_response['Role']['Arn']}")
                    role_arn = role_response['Role']['Arn']
                else:
                    print(f"❌ Error accessing IAM role: {e}")
                    return None
            
            # Attach S3 policy to the role
            if not self.attach_s3_policy(role_name):
                print(f"⚠️  Warning: Failed to attach S3 policy to role {role_name}")
            
            # Attach DynamoDB policy to the role
            if not self.attach_dynamodb_policy(role_name):
                print(f"⚠️  Warning: Failed to attach DynamoDB policy to role {role_name}")
            
            return role_arn
            
        except ClientError as e:
            print(f"❌ Error creating IAM role: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Error parsing IAM trust policy: {e}")
            return None
    
    def wait_for_iam_propagation(self):
        """Wait for IAM changes to propagate"""
        print("Waiting for IAM role propagation (30 seconds)...")
        time.sleep(30)
        print("IAM propagation wait complete")
    
    def function_exists(self):
        """Check if the Lambda function already exists"""
        if not self.get_client('lambda'):
            return False
        
        try:
            self.lambda_client.get_function(FunctionName=self.function_name)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                return False
            else:
                print(f"Error checking function existence: {e}")
                return False
    
    def destroy_lambda_function(self):
        """Delete the existing Lambda function"""
        if not self.get_client('lambda'):
            return False
        
        try:
            print(f"Checking if function {self.function_name} exists...")
            if self.function_exists():
                print(f"Deleting existing Lambda function: {self.function_name}")
                self.lambda_client.delete_function(FunctionName=self.function_name)
                print(f"✅ Successfully deleted Lambda function: {self.function_name}")
                
                # Wait a moment for the deletion to complete
                time.sleep(5)
                return True
            else:
                print(f"Function {self.function_name} does not exist, nothing to delete")
                return True
                
        except ClientError as e:
            print(f"❌ Error deleting Lambda function: {e}")
            return False
    
    def deploy_lambda(self, destroy_existing=False):
        """Deploy or update Lambda function with proper error handling"""
        try:
            # Validate AWS credentials early
            if not self.get_client('sts'):
                raise Exception("AWS credentials not configured or invalid")
            
            # Destroy existing function if requested
            if destroy_existing:
                if not self.destroy_lambda_function():
                    raise Exception("Failed to destroy existing Lambda function")
            
            # Get and verify layers
            layer_arns = self.get_layer_arns()
            if layer_arns and not self.verify_layers_exist(layer_arns):
                raise Exception("One or more specified layers were not found")
            
            # Create IAM role first (this is critical)
            role_arn = self.create_iam_role()
            if not role_arn:
                raise Exception("Failed to create or access IAM role")
            
            # Wait for IAM propagation to avoid "role cannot be assumed" error
            self.wait_for_iam_propagation()
            
            # Create deployment package
            package_name = self.create_deployment_package()
            
            # Read the deployment package
            with open(package_name, 'rb') as f:
                zip_content = f.read()
            
            if not self.get_client('lambda'):
                raise Exception("Failed to initialize Lambda client")
            
            # Prepare function configuration
            function_config = {
                'FunctionName': self.function_name,
                'Runtime': self.config['runtime'],
                'Role': role_arn,
                'Handler': self.config['handler'],
                'Code': {'ZipFile': zip_content},
                'Description': f'Lambda function for {self.function_name}',
                'MemorySize': int(self.config['memory']),
                'Timeout': int(self.config['timeout'])
            }
            
            # Add layers if specified
            if layer_arns:
                function_config['Layers'] = layer_arns
                print(f"Attaching {len(layer_arns)} layer(s) to function")
            
            try:
                # Try to update existing function (if we didn't destroy it)
                if not destroy_existing:
                    print("Updating function code...")
                    response = self.lambda_client.update_function_code(
                        FunctionName=self.function_name,
                        ZipFile=zip_content
                    )
                    
                    # Update configuration including layers
                    print("Updating function configuration...")
                    update_config = {
                        'FunctionName': self.function_name,
                        'Role': role_arn,
                        'Handler': self.config['handler'],
                        'Runtime': self.config['runtime'],
                        'MemorySize': int(self.config['memory']),
                        'Timeout': int(self.config['timeout'])
                    }
                    
                    if layer_arns:
                        update_config['Layers'] = layer_arns
                    
                    config_response = self.lambda_client.update_function_configuration(**update_config)
                    
                    print(f"✅ Updated Lambda function: {self.function_name}")
                    result = response
                else:
                    # Function was destroyed, create new one
                    print("Creating new Lambda function...")
                    response = self.lambda_client.create_function(**function_config)
                    print(f"✅ Created Lambda function: {self.function_name}")
                    result = response
                    
            except ClientError as e:
                if e.response['Error']['Code'] == 'ResourceNotFoundException':
                    # Function doesn't exist, create it
                    print("Creating new Lambda function...")
                    response = self.lambda_client.create_function(**function_config)
                    print(f"✅ Created Lambda function: {self.function_name}")
                    result = response
                else:
                    print(f"❌ AWS API error: {e}")
                    # Check if it's an IAM propagation issue
                    if "cannot be assumed" in str(e):
                        print("This might be an IAM propagation issue. Trying again in 10 seconds...")
                        time.sleep(10)
                        response = self.lambda_client.create_function(**function_config)
                        print(f"✅ Created Lambda function after retry: {self.function_name}")
                        result = response
                    else:
                        raise e
            
            # Clean up deployment package
            self.cleanup()
            
            return result
            
        except Exception as e:
            print(f"❌ Deployment failed: {e}")
            import traceback
            traceback.print_exc()
            self.cleanup()
            return None

def create_config_file():
    """Create a sample configuration file"""
    config_content = """[DEFAULT]
# Lambda function configuration
function_name = sample-lambda-function
region = us-east-1
runtime = python3.9
handler = sample.lambda_handler
memory = 128
timeout = 30

# IAM role (leave empty for auto-generated name)
role_name =

# S3 bucket for data access (required for S3 permissions)
s3_bucket = hsc-agent-bucket-2

# File paths
script_path = sample.py
requirements_file = requirements.txt

# Layer ARNs (comma-separated list of existing layer ARNs)
layers =

# Alternative config key for layers
layer_arns =
"""
    
    with open('deploy.config', 'w') as f:
        f.write(config_content)
    print("Created deploy.config file.")

def main():
    parser = argparse.ArgumentParser(description='Deploy Python script to AWS Lambda')
    parser.add_argument('--create-config', action='store_true', 
                       help='Create a sample configuration file')
    parser.add_argument('--config', default='deploy.config',
                       help='Configuration file path (default: deploy.config)')
    parser.add_argument('--skip-role-check', action='store_true',
                       help='Skip IAM role trust policy verification')
    parser.add_argument('--destroy', action='store_true',
                       help='Destroy existing Lambda function before deploying')
    
    args = parser.parse_args()
    
    if args.create_config:
        create_config_file()
        return
    
    print("Starting Lambda deployment...")
    
    try:
        # Initialize deployer
        deployer = LambdaDeployer(args.config)
        
        # Deploy Lambda function
        result = deployer.deploy_lambda(destroy_existing=args.destroy)
        
        if result:
            print(f"\n🎉 Deployment successful!")
            print(f"Function ARN: {result['FunctionArn']}")
            print(f"Function name: {result['FunctionName']}")
            
            layer_arns = deployer.get_layer_arns()
            if layer_arns:
                print(f"Attached layers: {len(layer_arns)}")
                for layer_arn in layer_arns:
                    print(f"  - {layer_arn}")
        else:
            print("\n❌ Deployment failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n⚠️  Deployment cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()