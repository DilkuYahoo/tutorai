#!/usr/bin/env python3
"""
Deploy Photo Gallery API Gateway (REST API)
"""

import os
import json
import boto3
from botocore.exceptions import ClientError

# Load configuration
def load_api_config():
    config_path = os.path.join(os.path.dirname(__file__), 'api-config.json')
    with open(config_path, 'r') as f:
        return json.load(f)


def create_or_update_api_gateway(config):
    """Create or update API Gateway"""
    apigateway = boto3.client('apigateway')
    lambda_client = boto3.client('lambda')
    
    api_name = config['apiName']
    stage_name = config['stageName']
    lambda_function = config['lambdaFunctionName']
    
    # Get Lambda ARN
    try:
        lambda_func = lambda_client.get_function(FunctionName=lambda_function)
        lambda_arn = lambda_func['Configuration']['FunctionArn']
    except ClientError as e:
        print(f"Error getting Lambda function: {e}")
        print("Make sure the Lambda function is deployed first!")
        return None
    
    # Get region from Lambda ARN
    REGION = lambda_arn.split(':')[3]
    
    # Try to get existing API
    try:
        apis = apigateway.get_rest_apis()['items']
        api = None
        for a in apis:
            if a['name'] == api_name:
                api = a
                break
        
        if api:
            api_id = api['id']
            print(f"Using existing API: {api_name} ({api_id})")
        else:
            # Create new API
            print(f"Creating new API: {api_name}")
            api = apigateway.create_rest_api(
                name=api_name,
                description=config['description']
            )
            api_id = api['id']
            print(f"API created: {api_id}")
    except Exception as e:
        print(f"Error checking for existing API: {e}")
        return None
    
    # Add routes
    print("\nAdding routes...")
    
    # Get root resource ID first
    root_resource = apigateway.get_resources(restApiId=api_id)
    root_id = None
    for r in root_resource['items']:
        if r['path'] == '/':
            root_id = r['id']
            break
    
    for endpoint in config['endpoints']:
        path = endpoint['path']
        http_method = endpoint['httpMethod']
        enable_cors = endpoint.get('enableCors', True)
        
        print(f"  {http_method} {path}")
        
        # Create resource path
        path_parts = path.split('/')
        parent_id = root_id
        
        for i, part in enumerate(path_parts[1:], 1):
            if '{' in part:
                # This is a path parameter
                part = part.replace('{', '').replace('}', '')
                path_part = '/'.join(path_parts[:i+1])
                
                try:
                    resource = apigateway.create_resource(
                        restApiId=api_id,
                        parentId=parent_id,
                        pathPart=f'{{{part}}}'
                    )
                    parent_id = resource['id']
                except:
                    # Resource might already exist
                    resources = apigateway.get_resources(restApiId=api_id)
                    for r in resources['items']:
                        if r.get('pathPart') == f'{{{part}}}':
                            parent_id = r['id']
                            break
            else:
                path_part = '/'.join(path_parts[:i+1])
                try:
                    resource = apigateway.create_resource(
                        restApiId=api_id,
                        parentId=parent_id,
                        pathPart=part
                    )
                    parent_id = resource['id']
                except:
                    # Resource might already exist
                    resources = apigateway.get_resources(restApiId=api_id)
                    for r in resources['items']:
                        if r['path'] == path_part:
                            parent_id = r['id']
                            break
        
        # Add method
        try:
            apigateway.put_method(
                restApiId=api_id,
                resourceId=parent_id,
                httpMethod=http_method,
                authorizationType='NONE'
            )
            
            # Add Lambda integration
            apigateway.put_integration(
                restApiId=api_id,
                resourceId=parent_id,
                httpMethod=http_method,
                type='AWS_PROXY',
                integrationHttpMethod='POST',
                uri=f'arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/{lambda_arn}/invocations'
            )
            
            # Add method response
            apigateway.put_method_response(
                restApiId=api_id,
                resourceId=parent_id,
                httpMethod=http_method,
                statusCode='200',
                responseParameters={
                    'method.response.header.Access-Control-Allow-Origin': True
                }
            )
            
            # Add integration response
            apigateway.put_integration_response(
                restApiId=api_id,
                resourceId=parent_id,
                httpMethod=http_method,
                statusCode='200',
                responseParameters={
                    'method.response.header.Access-Control-Allow-Origin': "'*'"
                }
            )
            
            # Add CORS OPTIONS method if enabled
            if enable_cors:
                try:
                    apigateway.put_method(
                        restApiId=api_id,
                        resourceId=parent_id,
                        httpMethod='OPTIONS',
                        authorizationType='NONE'
                    )
                    
                    apigateway.put_integration(
                        restApiId=api_id,
                        resourceId=parent_id,
                        httpMethod='OPTIONS',
                        type='MOCK',
                        requestTemplates={'application/json': '{"statusCode": 200}'}
                    )
                    
                    apigateway.put_method_response(
                        restApiId=api_id,
                        resourceId=parent_id,
                        httpMethod='OPTIONS',
                        statusCode='200',
                        responseParameters={
                            'method.response.header.Access-Control-Allow-Origin': True,
                            'method.response.header.Access-Control-Allow-Methods': True,
                            'method.response.header.Access-Control-Allow-Headers': True
                        }
                    )
                    
                    apigateway.put_integration_response(
                        restApiId=api_id,
                        resourceId=parent_id,
                        httpMethod='OPTIONS',
                        statusCode='200',
                        responseParameters={
                            'method.response.header.Access-Control-Allow-Origin': "'*'",
                            'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
                            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization'"
                        }
                    )
                except Exception as e:
                    print(f"    CORS options error: {e}")
                    
        except ClientError as e:
            if 'ConflictException' in str(e):
                print(f"    Route already exists, skipping...")
            else:
                print(f"    Error: {e}")
    
    # Deploy API
    print(f"\nDeploying to stage: {stage_name}")
    try:
        deployment = apigateway.create_deployment(
            restApiId=api_id,
            stageName=stage_name,
            description=config.get('description', 'Photo Gallery API')
        )
        print(f"API deployed successfully!")
    except ClientError as e:
        if 'ConflictException' in str(e):
            # Update deployment
            print("Updating existing deployment...")
            deployments = apigateway.get_deployments(restApiId=api_id)
            if deployments['items']:
                apigateway.update_deployment(
                    restApiId=api_id,
                    deploymentId=deployments['items'][0]['id'],
                    stageName=stage_name,
                    description=config.get('description', 'Updated deployment')
                )
        else:
            print(f"Deployment error: {e}")
    
    # Get API endpoint
    endpoint = f"https://{api_id}.execute-api.{REGION}.amazonaws.com/{stage_name}"
    
    print("\n" + "="*50)
    print("API Gateway deployment complete!")
    print(f"API Name: {api_name}")
    print(f"Stage: {stage_name}")
    print(f"Endpoint: {endpoint}")
    print("="*50)
    
    return endpoint


def main():
    """Main deployment function"""
    config = load_api_config()
    endpoint = create_or_update_api_gateway(config)
    
    if endpoint:
        print(f"\nAPI Endpoint URL: {endpoint}")
        print(f"Test albums endpoint: {endpoint}/albums")


if __name__ == '__main__':
    main()
