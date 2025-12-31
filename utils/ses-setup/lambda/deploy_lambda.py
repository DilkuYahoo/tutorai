#!/usr/bin/env python3
"""
Unified Deployment Script for QA Agent Lambda

Usage:
  python deploy_qa_agent.py --action deploy    # Deploy the Lambda function
  python deploy_qa_agent.py --action destroy   # Destroy the Lambda function
  python deploy_qa_agent.py --action status    # Check deployment status
"""

import json
import os
import time
import shutil
import glob
import zipfile
import argparse
import sys
try:
    import boto3
    from botocore.exceptions import ClientError
except ModuleNotFoundError:
    print("Error: boto3 and botocore are required to run this deployment script. Please install via 'pip install boto3 botocore'")
    exit(1)

HERE = os.path.dirname(__file__)
CONFIG_FILE = os.path.join(HERE, 'deployment-config.json')

class QAAgentDeployer:
    def __init__(self):
        self.config = self.load_config()
        self.aws_region = self.config['aws_region']
        self.lambda_config = self.config['lambda_function']
        
    def load_config(self):
        """Load deployment configuration from JSON file."""
        if not os.path.exists(CONFIG_FILE):
            print(f"Error: Configuration file '{CONFIG_FILE}' not found.")
            sys.exit(1)
            
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    
    def create_iam_role(self):
        """Create or update IAM role with necessary policies."""
        iam = boto3.client('iam')
        role_name = self.lambda_config['role_name']
        trust_policy = self.lambda_config['trust_policy']
        policy_arns = self.lambda_config['policies']
        custom_policies = self.lambda_config.get('custom_policies', [])
        
        try:
            resp = iam.get_role(RoleName=role_name)
            arn = resp['Role']['Arn']
            print(f"IAM role '{role_name}' already exists")
            
            # Attach any missing managed policies
            for policy_arn in policy_arns:
                try:
                    iam.attach_role_policy(RoleName=role_name, PolicyArn=policy_arn)
                    print(f"✅ Attached managed policy: {policy_arn}")
                except ClientError as e:
                    if e.response['Error']['Code'] == 'EntityAlreadyExists':
                        print(f"ℹ️  Managed policy already attached: {policy_arn}")
                    else:
                        print(f"❌ Error attaching managed policy {policy_arn}: {e}")
                        raise
            
            # Create/update inline policies
            for custom_policy in custom_policies:
                if not isinstance(custom_policy, dict) or 'PolicyName' not in custom_policy or 'PolicyDocument' not in custom_policy:
                    print(f"Warning: Invalid custom policy format: {custom_policy}. Skipping.")
                    continue
                policy_name = custom_policy['PolicyName']
                policy_document = custom_policy['PolicyDocument']
                try:
                    iam.put_role_policy(
                        RoleName=role_name,
                        PolicyName=policy_name,
                        PolicyDocument=json.dumps(policy_document)
                    )
                    print(f"✅ Created/updated inline policy: {policy_name}")
                except ClientError as e:
                    print(f"❌ Error creating inline policy {policy_name}: {e}")
                    raise
                    
            return arn
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchEntity':
                print(f"Creating IAM role '{role_name}'")
                resp = iam.create_role(
                    RoleName=role_name,
                    AssumeRolePolicyDocument=json.dumps(trust_policy)
                )
                arn = resp['Role']['Arn']
                
                # Attach managed policies
                for policy_arn in policy_arns:
                    iam.attach_role_policy(RoleName=role_name, PolicyArn=policy_arn)
                    print(f"✅ Attached managed policy: {policy_arn}")
                
                # Create inline policies
                for custom_policy in custom_policies:
                    if not isinstance(custom_policy, dict) or 'PolicyName' not in custom_policy or 'PolicyDocument' not in custom_policy:
                        print(f"Warning: Invalid custom policy format: {custom_policy}. Skipping.")
                        continue
                    policy_name = custom_policy['PolicyName']
                    policy_document = custom_policy['PolicyDocument']
                    iam.put_role_policy(
                        RoleName=role_name,
                        PolicyName=policy_name,
                        PolicyDocument=json.dumps(policy_document)
                    )
                    print(f"✅ Created inline policy: {policy_name}")
                
                return arn
            else:
                raise
    
    def wait_for_iam_propagation(self, seconds=30):
        """Wait for IAM role propagation."""
        print(f"Waiting for IAM role propagation ({seconds} seconds)...")
        time.sleep(seconds)
    
    def package_lambda_code(self):
        """Package Lambda function code into a ZIP file."""
        code_file = self.lambda_config['file_name']
        function_name = self.lambda_config['name']
        zip_name = f"{function_name}.zip"
        zip_path = os.path.join(HERE, zip_name)
        
        # Check if source file exists
        if not os.path.exists(os.path.join(HERE, code_file)):
            print(f"Error: Lambda source file '{code_file}' not found.")
            sys.exit(1)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(os.path.join(HERE, code_file), code_file)
        print(f"Created deployment package: {zip_name}")
        return zip_path
    
    def deploy_lambda_function(self):
        """Deploy or update the Lambda function."""
        lambda_client = boto3.client('lambda', region_name=self.aws_region)
        
        # Create IAM role
        role_arn = self.create_iam_role()
        self.wait_for_iam_propagation()
        
        # Package code
        zip_path = self.package_lambda_code()
        with open(zip_path, 'rb') as f:
            zip_bytes = f.read()

        # Prepare environment variables
        env_dict = self.lambda_config.get('environment', {}).get('variables', {})
        if not env_dict:
            raise ValueError("No environment variables defined in deployment-config.json")

        # Prepare function parameters
        params = {
            'FunctionName': self.lambda_config['name'],
            'Runtime': self.lambda_config['runtime'],
            'Role': role_arn,
            'Handler': self.lambda_config['handler'],
            'Code': {'ZipFile': zip_bytes},
            'Description': self.lambda_config.get('description', ''),
            'Timeout': self.lambda_config['timeout'],
            'MemorySize': self.lambda_config['memory_size'],
            'Layers': self.lambda_config.get('layers', []),
            'Environment': {'Variables': env_dict}
        }
        
        try:
            # Try to update existing function
            print(f"Updating Lambda function '{self.lambda_config['name']}'")
            lambda_client.update_function_code(
                FunctionName=self.lambda_config['name'], 
                ZipFile=zip_bytes
            )
            lambda_client.update_function_configuration(
                **{k: params[k] for k in ['FunctionName', 'Role', 'Handler', 'Runtime', 'Timeout', 'MemorySize', 'Layers', 'Environment']}
            )
            print(f"✅ Successfully updated Lambda function '{self.lambda_config['name']}'")
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                # Create new function
                print(f"Creating Lambda function '{self.lambda_config['name']}'")
                lambda_client.create_function(**params)
                print(f"✅ Successfully created Lambda function '{self.lambda_config['name']}'")
            else:
                raise
        
        # Clean up deployment package
        try:
            os.remove(zip_path)
            print(f"Removed deployment package: {zip_path}")
        except OSError as e:
            print(f"Warning: could not remove zip file {zip_path}: {e}")
    
    def destroy_lambda_function(self):
        """Destroy the Lambda function and associated IAM resources."""
        lambda_client = boto3.client('lambda', region_name=self.aws_region)
        
        # Delete Lambda function
        function_name = self.lambda_config['name']
        try:
            print(f"Deleting Lambda function '{function_name}'")
            lambda_client.delete_function(FunctionName=function_name)
            print(f"✅ Successfully deleted Lambda function '{function_name}'")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                print(f"Lambda function '{function_name}' not found (already deleted)")
            else:
                print(f"Error deleting Lambda function: {e}")
    
    def destroy_iam_role(self):
        """Destroy IAM role and associated policies."""
        iam = boto3.client('iam')
        role_name = self.lambda_config['role_name']
        policy_arns = self.lambda_config['policies']
        custom_policies = self.lambda_config.get('custom_policies', [])
        
        # Delete inline policies first
        for custom_policy in custom_policies:
            policy_name = custom_policy['PolicyName']
            try:
                iam.delete_role_policy(RoleName=role_name, PolicyName=policy_name)
                print(f"Deleted inline policy: {policy_name}")
            except ClientError as e:
                if e.response['Error']['Code'] != 'NoSuchEntity':
                    print(f"Warning deleting inline policy '{policy_name}': {e}")
        
        # Detach managed policies
        for policy_arn in policy_arns:
            try:
                iam.detach_role_policy(RoleName=role_name, PolicyArn=policy_arn)
                print(f"Detached managed policy: {policy_arn}")
            except ClientError as e:
                if e.response['Error']['Code'] != 'NoSuchEntity':
                    print(f"Warning detaching policy '{policy_arn}': {e}")
        
        # Wait for detach propagation
        time.sleep(5)
        
        # Delete the role
        try:
            iam.delete_role(RoleName=role_name)
            print(f"✅ Deleted IAM role '{role_name}'")
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchEntity':
                print(f"IAM role '{role_name}' not found (already deleted)")
            else:
                print(f"Error deleting IAM role '{role_name}': {e}")
    
    def check_status(self):
        """Check the current deployment status."""
        lambda_client = boto3.client('lambda', region_name=self.aws_region)
        iam = boto3.client('iam')
        
        function_name = self.lambda_config['name']
        role_name = self.lambda_config['role_name']
        
        print("🔍 Checking deployment status...")
        
        # Check Lambda function
        try:
            response = lambda_client.get_function(FunctionName=function_name)
            state = response['Configuration']['State']
            last_modified = response['Configuration']['LastModified']
            print(f"✅ Lambda function '{function_name}' exists")
            print(f"   State: {state}")
            print(f"   Last Modified: {last_modified}")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                print(f"❌ Lambda function '{function_name}' not found")
            else:
                print(f"Error checking Lambda function: {e}")
        
        # Check IAM role
        try:
            response = iam.get_role(RoleName=role_name)
            print(f"✅ IAM role '{role_name}' exists")
            print(f"   ARN: {response['Role']['Arn']}")
            
            # Check attached policies
            policies = iam.list_attached_role_policies(RoleName=role_name)
            if policies['AttachedPolicies']:
                print("   Managed Policies:")
                for policy in policies['AttachedPolicies']:
                    print(f"     - {policy['PolicyName']}")
            
            # Check inline policies
            inline_policies = iam.list_role_policies(RoleName=role_name)
            if inline_policies['PolicyNames']:
                print("   Inline Policies:")
                for policy_name in inline_policies['PolicyNames']:
                    print(f"     - {policy_name}")
                    
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchEntity':
                print(f"❌ IAM role '{role_name}' not found")
            else:
                print(f"Error checking IAM role: {e}")
    
    def cleanup_artifacts(self):
        """Clean up deployment artifacts."""
        print("🧹 Cleaning up artifacts...")
        
        # Remove zip files
        for zip_file in glob.glob(os.path.join(HERE, '*.zip')):
            try:
                os.remove(zip_file)
                print(f"Removed zip file: {zip_file}")
            except OSError as e:
                print(f"Warning: could not remove zip file {zip_file}: {e}")
        
        # Remove __pycache__ directories
        for root, dirs, files in os.walk(HERE):
            for d in dirs:
                if d == '__pycache__':
                    cache_dir = os.path.join(root, d)
                    try:
                        shutil.rmtree(cache_dir)
                        print(f"Removed directory: {cache_dir}")
                    except OSError as e:
                        print(f"Warning: could not remove directory {cache_dir}: {e}")
    
    def deploy(self):
        """Execute full deployment."""
        print("🚀 Starting QA Agent deployment...")
        self.deploy_lambda_function()
        self.cleanup_artifacts()
        print("✅ Deployment completed successfully!")
    
    def destroy(self):
        """Execute full destruction."""
        print("🗑️  Starting QA Agent teardown...")
        self.destroy_lambda_function()
        self.destroy_iam_role()
        self.cleanup_artifacts()
        print("✅ Teardown completed successfully!")

def main():
    parser = argparse.ArgumentParser(description='QA Agent Lambda Deployment Script')
    parser.add_argument('--action', 
                       choices=['deploy', 'destroy', 'status', 'cleanup'],
                       required=True,
                       help='Action to perform: deploy, destroy, status, or cleanup')
    
    args = parser.parse_args()
    
    deployer = QAAgentDeployer()
    
    try:
        if args.action == 'deploy':
            deployer.deploy()
        elif args.action == 'destroy':
            deployer.destroy()
        elif args.action == 'status':
            deployer.check_status()
        elif args.action == 'cleanup':
            deployer.cleanup_artifacts()
            
    except Exception as e:
        print(f"❌ Error during {args.action}: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()