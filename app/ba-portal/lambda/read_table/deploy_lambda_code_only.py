#!/usr/bin/env python3
"""
Script to deploy only the code in the deployed lambda.
This script updates the lambda function code without changing its configuration.
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
    
    # Ensure all required keys are present
    required_keys = ['function_name', 'region', 'script_path']
    for key in required_keys:
        if key not in config['DEFAULT']:
            logger.error(f"Missing required configuration key: {key}")
            raise KeyError(f"Missing required configuration key: {key}")
    
    return config['DEFAULT']

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
    # Create a zip buffer
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add the main script file
        script_path = config['script_path']
        logger.info(f"Adding script file: {script_path}")
        zipf.write(script_path, arcname=os.path.basename(script_path))
        
        # Add the libs directory if it exists
        libs_dir = os.path.join(os.path.dirname(script_path), 'libs')
        if os.path.exists(libs_dir):
            logger.info(f"Adding libs directory: {libs_dir}")
            for root, dirs, files in os.walk(libs_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.join('libs', os.path.relpath(file_path, libs_dir))
                    zipf.write(file_path, arcname=arcname)
                    logger.info(f"Added file: {file_path}")
    
    # Return the zip buffer content
    zip_buffer.seek(0)
    return zip_buffer.read()

def deploy_lambda_code(config):
    """Deploy the lambda code using the provided configuration."""
    lambda_client = boto3.client('lambda', region_name=config['region'])
    
    # Check if the lambda function exists
    if not check_lambda_function_exists(lambda_client, config['function_name']):
        logger.error("Cannot deploy code: Lambda function does not exist")
        return None
    
    # Create the deployment package
    deployment_package = create_lambda_deployment_package(config)
    
    # Update the lambda function code
    logger.info(f"Updating lambda function code for {config['function_name']}")
    try:
        response = lambda_client.update_function_code(
            FunctionName=config['function_name'],
            ZipFile=deployment_package,
        )
        logger.info(f"Lambda function code updated successfully: {response['FunctionArn']}")
        return response
    except Exception as e:
        logger.error(f"Error updating lambda function code: {e}")
        return None

def main(config_file_path=None):
    # Check if config file path is provided
    if config_file_path is None:
        logger.error("Config file path is required to run the script")
        print("Config file path is required to run the script")
        return
    
    # Read the configuration
    config = read_config(config_file_path)
    
    # Deploy the lambda code
    deploy_lambda_code(config)

if __name__ == '__main__':
    import sys
    # Check if config file path is provided as a command-line argument
    if len(sys.argv) < 2:
        logger.error("Config file path is required to run the script")
        print("Config file path is required to run the script")
        print("Usage: python deploy_lamdba_code_only.py <config_file_path>")
        sys.exit(1)
    
    config_file_path = sys.argv[1]
    main(config_file_path)