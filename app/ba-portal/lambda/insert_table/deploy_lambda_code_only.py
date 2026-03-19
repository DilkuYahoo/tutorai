#!/usr/bin/env python3
"""
Script to deploy only the code in the deployed ba_agent lambda.
This script updates the lambda function code without changing its configuration.

Usage:
    python deploy_lambda_code_only.py deploy.config
"""

import boto3
import os
import configparser
import zipfile
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def read_config(config_file_path):
    """Read the configuration file and return the settings."""
    logger.info(f"Reading configuration from {config_file_path}")
    config = configparser.ConfigParser()
    config.read(config_file_path)
    
    # Default configuration
    defaults = {
        'function_name': 'ba-portal-ba-agent-lambda-function',
        'region': 'ap-southeast-2',
        'runtime': 'python3.13',
        'handler': 'main.lambda_handler',
        'memory': '256',
        'timeout': '30',
        'role_name': 'ba-portal-ba-agent-lambda-role',
        'script_path': 'main.py',
        'requirements_file': 'requirements.txt',
        's3_bucket': 'ba-portal-lambda-bucket',
    }
    
    if 'DEFAULT' in config:
        defaults.update(dict(config['DEFAULT']))
    
    # Ensure all required keys are present
    required_keys = ['function_name', 'region', 'script_path']
    for key in required_keys:
        if key not in defaults:
            logger.error(f"Missing required configuration key: {key}")
            raise KeyError(f"Missing required configuration key: {key}")
    
    return defaults


def check_lambda_function_exists(lambda_client, function_name):
    """Check if the lambda function exists."""
    try:
        response = lambda_client.get_function(FunctionName=function_name)
        logger.info(f"Lambda function {function_name} exists")
        return True
    except lambda_client.exceptions.ResourceNotFoundException:
        logger.error(f"Lambda function {function_name} does not exist")
        return False
    except Exception as e:
        logger.error(f"Error checking lambda function: {e}")
        return False


def create_lambda_deployment_package(config):
    """Create a zip file containing the lambda function code and its dependencies."""
    logger.info("Creating lambda deployment package")
    
    script_path = config['script_path']
    script_dir = os.path.dirname(script_path) if script_path else '.'
    
    # Create a zip buffer
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add the main script file
        logger.info(f"Adding script file: {script_path}")
        zipf.write(script_path, arcname=os.path.basename(script_path))
        
        # Add the lib directory if it exists (for bedrock_client)
        lib_dir = 'lib'
        if os.path.exists(lib_dir) and os.path.isdir(lib_dir):
            logger.info(f"Adding lib directory: {lib_dir}")
            for root, dirs, files in os.walk(lib_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, start='.')
                    zipf.write(file_path, arcname=arcname)
                    logger.info(f"Added file: {file_path} -> {arcname}")
        else:
            logger.warning(f"Lib directory '{lib_dir}' not found")
        
        # Also check for libs directory (alternative naming)
        libs_dir = 'libs'
        if os.path.exists(libs_dir) and os.path.isdir(libs_dir):
            logger.info(f"Adding libs directory: {libs_dir}")
            for root, dirs, files in os.walk(libs_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, start='.')
                    zipf.write(file_path, arcname=arcname)
                    logger.info(f"Added file: {file_path} -> {arcname}")
    
    # Return the zip buffer content
    zip_buffer.seek(0)
    return zip_buffer.read()


def deploy_lambda_code(config):
    """Deploy the lambda code using the provided configuration."""
    region = config.get('region', 'ap-southeast-2')
    lambda_client = boto3.client('lambda', region_name=region)
    
    # Check if the lambda function exists
    function_name = config['function_name']
    if not check_lambda_function_exists(lambda_client, function_name):
        logger.error("Cannot deploy code: Lambda function does not exist")
        return None
    
    # Create the deployment package
    deployment_package = create_lambda_deployment_package(config)
    
    # Update the lambda function code
    logger.info(f"Updating lambda function code for {function_name}")
    try:
        response = lambda_client.update_function_code(
            FunctionName=function_name,
            ZipFile=deployment_package,
        )
        logger.info(f"Lambda function code updated successfully: {response['FunctionArn']}")
        print(f"✅ Updated Lambda function: {function_name}")
        return response
    except Exception as e:
        logger.error(f"Error updating lambda function code: {e}")
        print(f"❌ Error updating lambda function: {e}")
        return None


def main(config_file_path=None):
    # Check if config file path is provided
    if config_file_path is None:
        logger.error("Config file path is required to run the script")
        print("Config file path is required to run the script")
        return
    
    # Read the configuration
    config = read_config(config_file_path)
    
    # Print configuration info
    print(f"Deploying BA Agent Lambda code...")
    print(f"  Function: {config['function_name']}")
    print(f"  Region: {config['region']}")
    print(f"  Script: {config['script_path']}")
    print("-" * 40)
    
    # Deploy the lambda code
    result = deploy_lambda_code(config)
    
    if result:
        print(f"\n🎉 Code deployment successful!")
        print(f"Function ARN: {result['FunctionArn']}")
    else:
        print("\n❌ Code deployment failed!")
        import sys
        sys.exit(1)


if __name__ == '__main__':
    import sys
    # Check if config file path is provided as a command-line argument
    if len(sys.argv) < 2:
        print("Usage: python deploy_lambda_code_only.py <config_file_path>")
        print("Example: python deploy_lambda_code_only.py deploy.config")
        sys.exit(1)
    
    config_file_path = sys.argv[1]
    main(config_file_path)
