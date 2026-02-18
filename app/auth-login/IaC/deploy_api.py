#!/usr/bin/env python3
"""
AWS API Gateway Deployment Script for Auth Login

Handles Lambda function endpoint with proper CORS configuration.

Usage:
    python deploy_api.py [--config api-config.json]
"""

import boto3
import json
import argparse
from botocore.exceptions import ClientError


class APIGatewayDeployer:
    def __init__(self, config_file='api-config.json', region='ap-southeast-2'):
        self.config = self.load_config(config_file)
        self.region = region
        self.api_client = boto3.client('apigateway', region_name=region)
        self.lambda_client = boto3.client('lambda', region_name=region)

    def load_config(self, config_file):
        """Load API configuration from JSON file"""
        config_path = config_file
        if not os.path.isabs(config_file):
            config_path = os.path.join(os.path.dirname(__file__), config_file)
        
        with open(config_path, 'r') as f:
            return json.load(f)

    def lambda_exists(self, function_name):
        """Check if Lambda function exists"""
        try:
            self.lambda_client.get_function(FunctionName=function_name)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                return False
            raise

    def get_lambda_arn(self, function_name):
        """Get Lambda function ARN"""
        try:
            response = self.lambda_client.get_function(FunctionName=function_name)
            return response['Configuration']['FunctionArn']
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                raise Exception(f"Lambda function '{function_name}' not found. Please deploy the Lambda function first using deploy_lambda.py")
            else:
                raise

    def create_or_update_api(self):
        """Create or update REST API"""
        api_name = self.config['api_name']
        description = self.config.get('description', '')

        # Check if API already exists
        existing_apis = self.api_client.get_rest_apis()
        api_id = None
        for api in existing_apis['items']:
            if api['name'] == api_name:
                api_id = api['id']
                break

        if api_id:
            print(f"Using existing API: {api_name} (ID: {api_id})")
        else:
            print(f"Creating new API: {api_name}")
            response = self.api_client.create_rest_api(
                name=api_name,
                description=description
            )
            api_id = response['id']

        return api_id

    def get_account_id(self):
        """Get AWS account ID"""
        sts_client = boto3.client('sts', region_name=self.region)
        identity = sts_client.get_caller_identity()
        return identity['Account']

    def find_or_create_resource(self, api_id, parent_id, path_part):
        """Find existing resource or create new one"""
        resources = self.api_client.get_resources(restApiId=api_id)
        for resource in resources['items']:
            if resource.get('parentId') == parent_id and resource.get('pathPart') == path_part:
                return resource['id']

        # Create new resource if not found
        response = self.api_client.create_resource(
            restApiId=api_id,
            parentId=parent_id,
            pathPart=path_part
        )
        return response['id']

    def add_resources_and_methods(self, api_id):
        """Add resources and methods for each endpoint"""
        import os as os_module
        
        root_id = self.api_client.get_resources(restApiId=api_id)['items'][0]['id']
        account_id = self.get_account_id()

        for endpoint in self.config['endpoints']:
            path = endpoint['path']
            method = endpoint['method']
            function_name = endpoint['lambda_integration']['function_name']

            # Find or create resource
            path_part = path.strip('/')
            resource_id = self.find_or_create_resource(api_id, root_id, path_part)

            # Add or update method
            try:
                self.api_client.put_method(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=method,
                    authorizationType='NONE'
                )
                print(f"Created method {method} for {path}")
            except ClientError as e:
                if e.response['Error']['Code'] == 'ConflictException':
                    print(f"Method {method} for {path} already exists, updating...")
                else:
                    raise

            # Get Lambda function ARN
            lambda_arn = self.get_lambda_arn(function_name)

            # Add or update Lambda integration
            uri = f"arn:aws:apigateway:{self.region}:lambda:path/2015-03-31/functions/{lambda_arn}/invocations"
            try:
                self.api_client.put_integration(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=method,
                    type='AWS_PROXY',
                    integrationHttpMethod='POST',
                    uri=uri
                )
                print(f"Created integration for {method} {path}")
            except ClientError as e:
                if e.response['Error']['Code'] == 'ConflictException':
                    print(f"Integration for {method} {path} already exists, updating...")
                    self.api_client.update_integration(
                        restApiId=api_id,
                        resourceId=resource_id,
                        httpMethod=method,
                        patchOperations=[
                            {'op': 'replace', 'path': '/uri', 'value': uri},
                            {'op': 'replace', 'path': '/type', 'value': 'AWS_PROXY'},
                            {'op': 'replace', 'path': '/integrationHttpMethod', 'value': 'POST'}
                        ]
                    )
                else:
                    raise

            # Add method response with CORS headers
            try:
                self.api_client.put_method_response(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=method,
                    statusCode='200',
                    responseParameters={
                        'method.response.header.Access-Control-Allow-Origin': True
                    }
                )
            except ClientError:
                pass

            # Add integration response with CORS headers
            try:
                self.api_client.put_integration_response(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=method,
                    statusCode='200',
                    responseParameters={
                        'method.response.header.Access-Control-Allow-Origin': "'*'"
                    },
                    responseTemplates={'application/json': ''}
                )
            except ClientError:
                pass

            # Add permission for API Gateway to invoke Lambda
            statement_id = f'api-gateway-{api_id}-{resource_id}'
            source_arn = f'arn:aws:execute-api:{self.region}:{account_id}:{api_id}/*/{method}{path}'

            try:
                self.lambda_client.add_permission(
                    FunctionName=function_name,
                    StatementId=statement_id,
                    Action='lambda:InvokeFunction',
                    Principal='apigateway.amazonaws.com',
                    SourceArn=source_arn
                )
                print(f"Added Lambda permission for {method} {path}")
            except ClientError as e:
                if e.response['Error']['Code'] == 'ResourceConflictException':
                    print(f"Lambda permission for {method} {path} already exists")
                else:
                    raise

            print(f"Added {method} {path} -> {function_name}")

    def enable_cors(self, api_id):
        """Enable CORS for all methods"""
        if not self.config.get('cors', {}).get('enabled'):
            return

        cors_config = self.config.get('cors', {})
        allowed_origins = cors_config.get('origins', ['*'])
        allowed_methods = cors_config.get('methods', ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
        allowed_headers = cors_config.get('headers', ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'])

        # Get all resources
        resources = self.api_client.get_resources(restApiId=api_id)

        for resource in resources['items']:
            if resource['path'] == '/':
                continue  # Skip root resource

            resource_id = resource['id']

            # Add OPTIONS method for CORS preflight
            try:
                self.api_client.put_method(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod='OPTIONS',
                    authorizationType='NONE'
                )
                print(f"Added OPTIONS method for {resource['path']}")
            except ClientError as e:
                if e.response['Error']['Code'] != 'ConflictException':
                    print(f"Error adding OPTIONS method: {e}")

            # Add method response for OPTIONS
            try:
                self.api_client.put_method_response(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod='OPTIONS',
                    statusCode='200',
                    responseParameters={
                        'method.response.header.Access-Control-Allow-Headers': True,
                        'method.response.header.Access-Control-Allow-Methods': True,
                        'method.response.header.Access-Control-Allow-Origin': True,
                        'method.response.header.Access-Control-Max-Age': True
                    }
                )
            except ClientError:
                pass

            # Add integration for OPTIONS (MOCK)
            try:
                self.api_client.put_integration(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod='OPTIONS',
                    type='MOCK',
                    requestTemplates={'application/json': '{"statusCode": 200}'}
                )
            except ClientError:
                pass

            # Add integration response for OPTIONS
            try:
                self.api_client.put_integration_response(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod='OPTIONS',
                    statusCode='200',
                    responseParameters={
                        'method.response.header.Access-Control-Allow-Headers': f"'{', '.join(allowed_headers)}'",
                        'method.response.header.Access-Control-Allow-Methods': f"'{', '.join(allowed_methods)}'",
                        'method.response.header.Access-Control-Allow-Origin': "'*'",
                        'method.response.header.Access-Control-Max-Age': "'3600'"
                    },
                    responseTemplates={'application/json': ''}
                )
            except ClientError:
                pass

        print("CORS configuration completed")

    def deploy_api(self, api_id):
        """Deploy API to stages"""
        for stage in self.config.get('stages', []):
            stage_name = stage['name']
            description = stage.get('description', '')

            try:
                self.api_client.create_deployment(
                    restApiId=api_id,
                    stageName=stage_name,
                    description=description
                )
                print(f"Deployed to stage: {stage_name}")
            except ClientError as e:
                if e.response['Error']['Code'] == 'BadRequestException':
                    # Stage already exists, create new deployment
                    self.api_client.create_deployment(
                        restApiId=api_id,
                        stageName=stage_name,
                        description=f"Update - {description}"
                    )
                    print(f"Updated stage: {stage_name}")
                else:
                    raise

    def deploy(self):
        """Main deployment function"""
        import os as os_module
        
        # Validate all Lambda functions exist
        for endpoint in self.config['endpoints']:
            function_name = endpoint['lambda_integration']['function_name']
            if not self.lambda_exists(function_name):
                raise Exception(f"Lambda function '{function_name}' does not exist. Please deploy the Lambda function first using: python deploy_lambda.py")

        # Get Lambda ARNs for validation
        for endpoint in self.config['endpoints']:
            function_name = endpoint['lambda_integration']['function_name']
            lambda_arn = self.get_lambda_arn(function_name)
            print(f"Lambda function ARN: {lambda_arn}")

        api_id = self.create_or_update_api()
        self.add_resources_and_methods(api_id)
        self.enable_cors(api_id)
        self.deploy_api(api_id)

        # Get API URL
        api_url = f"https://{api_id}.execute-api.{self.region}.amazonaws.com"
        print(f"\nAPI deployed successfully!")
        
        for stage in self.config.get('stages', []):
            stage_name = stage['name']
            print(f"Stage '{stage_name}' URL: {api_url}/{stage_name}/user-info")
        
        return api_id, api_url


import os

def main():
    parser = argparse.ArgumentParser(description='Deploy API Gateway for Auth Login Lambda function')
    parser.add_argument('--config', default='api-config.json', help='Configuration file')
    parser.add_argument('--region', default='ap-southeast-2', help='AWS region')

    args = parser.parse_args()

    deployer = APIGatewayDeployer(args.config, args.region)
    deployer.deploy()


if __name__ == '__main__':
    main()