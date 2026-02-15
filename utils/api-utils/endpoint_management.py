#!/usr/bin/env python3
"""
AWS API Gateway Endpoint Management Script

This script provides functionality to:
- Add endpoints to an existing API Gateway
- Remove endpoints from an API Gateway
- Integrate endpoints with Lambda functions
- Set up necessary IAM permissions
- Enable CloudWatch logging for API Gateway
- View changes and current configuration

All ARNs and unique identifiers are configured at the top of this script.
"""

import boto3
import json
import argparse
import time
import sys
from botocore.exceptions import ClientError
from typing import Dict, List, Optional, Any


# ============================================================================
# CONFIGURATION - Modify these values as needed
# ============================================================================

# AWS Region
REGION = 'ap-southeast-2'

# API Gateway Configuration
API_ID = 'your-api-id-here'  # e.g., 'abc123def4'
API_NAME = None  # Optional: Use API name instead of ID (set API_ID to None if using name)

# Lambda Configuration
LAMBDA_FUNCTION_NAME = 'your-lambda-function-name'
LAMBDA_FUNCTION_ARN = f'arn:aws:lambda:{REGION}:YOUR_ACCOUNT_ID:function:{LAMBDA_FUNCTION_NAME}'

# IAM Role Configuration
LAMBDA_EXECUTION_ROLE_NAME = 'api-gateway-lambda-execution-role'
API_GATEWAY_CLOUDWATCH_ROLE_NAME = 'APIGateway-CloudWatch-Logs-Role'

# CloudWatch Logging Configuration
LOG_GROUP_NAME_PREFIX = 'API-Gateway-Execution-Logs'
LOG_RETENTION_DAYS = 30
LOG_LEVEL = 'INFO'  # Options: OFF, ERROR, INFO

# Stage Configuration
DEFAULT_STAGE_NAME = 'prod'
DEPLOYMENT_DESCRIPTION = 'Endpoint management deployment'

# Default Endpoint Configuration
DEFAULT_HTTP_METHOD = 'POST'
DEFAULT_ENDPOINT_PATH = '/api/v1/resource'
DEFAULT_AUTH_TYPE = 'NONE'  # Options: NONE, AWS_IAM, COGNITO_USER_POOLS

# Cognito Configuration (if using COGNITO_USER_POOLS auth)
COGNITO_USER_POOL_ARN = None  # e.g., 'arn:aws:cognito-idp:region:account-id:userpool/pool-id'

# CORS Configuration
ENABLE_CORS = True
CORS_ALLOW_ORIGINS = "'*'"
CORS_ALLOW_METHODS = "'GET,POST,PUT,DELETE,OPTIONS'"
CORS_ALLOW_HEADERS = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"

# ============================================================================
# END OF CONFIGURATION
# ============================================================================


class EndpointManager:
    """
    Manages API Gateway endpoints with Lambda integration.
    
    This class provides methods to:
    - Add/remove endpoints
    - Configure Lambda integrations
    - Set up IAM permissions
    - Enable logging
    - View current configuration
    """
    
    def __init__(self, api_id: str = None, api_name: str = None, region: str = REGION):
        """
        Initialize the EndpointManager.
        
        Args:
            api_id: The API Gateway ID
            api_name: The API Gateway name (alternative to api_id)
            region: AWS region
        """
        self.region = region
        self.api_id = api_id
        self.api_name = api_name
        
        # Initialize AWS clients
        self.api_client = boto3.client('apigateway', region_name=region)
        self.lambda_client = boto3.client('lambda', region_name=region)
        self.iam_client = boto3.client('iam', region_name=region)
        self.sts_client = boto3.client('sts', region_name=region)
        self.logs_client = boto3.client('logs', region_name=region)
        
        # Cache for account ID
        self._account_id = None
        
    @property
    def account_id(self) -> str:
        """Get AWS account ID (cached)."""
        if self._account_id is None:
            identity = self.sts_client.get_caller_identity()
            self._account_id = identity['Account']
        return self._account_id
    
    def get_api_id(self) -> str:
        """
        Get API ID from name or validate provided ID.
        
        Returns:
            The API Gateway ID
            
        Raises:
            ValueError: If API cannot be found
        """
        if self.api_id:
            # Validate the API exists
            try:
                self.api_client.get_rest_api(restApiId=self.api_id)
                return self.api_id
            except ClientError as e:
                if e.response['Error']['Code'] == 'NotFoundException':
                    raise ValueError(f"API with ID '{self.api_id}' not found")
                raise
        
        if self.api_name:
            # Find API by name
            response = self.api_client.get_rest_apis()
            for api in response.get('items', []):
                if api['name'] == self.api_name:
                    self.api_id = api['id']
                    return self.api_id
            raise ValueError(f"API with name '{self.api_name}' not found")
        
        raise ValueError("Either api_id or api_name must be provided")
    
    # =========================================================================
    # RESOURCE MANAGEMENT
    # =========================================================================
    
    def get_resource_id(self, path: str) -> Optional[str]:
        """
        Get resource ID for a given path.
        
        Args:
            path: The API endpoint path (e.g., '/api/v1/resource')
            
        Returns:
            Resource ID or None if not found
        """
        api_id = self.get_api_id()
        resources = self.api_client.get_resources(restApiId=api_id)
        
        for resource in resources.get('items', []):
            if resource['path'] == path:
                return resource['id']
        
        return None
    
    def get_or_create_resource(self, path: str) -> str:
        """
        Get existing resource ID or create new resource for the path.
        
        Args:
            path: The API endpoint path
            
        Returns:
            Resource ID
        """
        api_id = self.get_api_id()
        
        # Check if resource already exists
        existing_id = self.get_resource_id(path)
        if existing_id:
            print(f"✓ Resource already exists: {path} (ID: {existing_id})")
            return existing_id
        
        # Create resource path segments
        path_parts = [p for p in path.split('/') if p]
        
        # Get root resource ID
        resources = self.api_client.get_resources(restApiId=api_id)
        root_id = None
        for resource in resources.get('items', []):
            if resource['path'] == '/':
                root_id = resource['id']
                break
        
        if not root_id:
            raise ValueError("Root resource not found")
        
        # Create each path segment
        current_path = ''
        parent_id = root_id
        
        for part in path_parts:
            current_path += f'/{part}'
            
            # Check if this segment already exists
            existing_id = self.get_resource_id(current_path)
            if existing_id:
                parent_id = existing_id
                continue
            
            # Create the resource
            print(f"Creating resource: {current_path}")
            response = self.api_client.create_resource(
                restApiId=api_id,
                parentId=parent_id,
                pathPart=part
            )
            parent_id = response['id']
            print(f"✓ Created resource: {current_path} (ID: {parent_id})")
        
        return parent_id
    
    def delete_resource(self, path: str) -> bool:
        """
        Delete a resource (endpoint) from the API.
        
        Args:
            path: The API endpoint path to delete
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        resource_id = self.get_resource_id(path)
        
        if not resource_id:
            print(f"✗ Resource not found: {path}")
            return False
        
        try:
            self.api_client.delete_resource(
                restApiId=api_id,
                resourceId=resource_id
            )
            print(f"✓ Deleted resource: {path}")
            return True
        except ClientError as e:
            print(f"✗ Error deleting resource: {e}")
            return False
    
    # =========================================================================
    # METHOD MANAGEMENT
    # =========================================================================
    
    def add_method(
        self,
        path: str,
        http_method: str = DEFAULT_HTTP_METHOD,
        auth_type: str = DEFAULT_AUTH_TYPE,
        api_key_required: bool = False,
        request_parameters: Dict = None,
        request_models: Dict = None
    ) -> bool:
        """
        Add an HTTP method to a resource.
        
        Args:
            path: The API endpoint path
            http_method: HTTP method (GET, POST, PUT, DELETE, etc.)
            auth_type: Authorization type (NONE, AWS_IAM, COGNITO_USER_POOLS)
            api_key_required: Whether API key is required
            request_parameters: Request parameters configuration
            request_models: Request models configuration
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        resource_id = self.get_or_create_resource(path)
        
        # Normalize HTTP method
        http_method = http_method.upper()
        
        # Build authorization settings
        authorization_type = auth_type
        authorizer_id = None
        
        if auth_type == 'COGNITO_USER_POOLS':
            if not COGNITO_USER_POOL_ARN:
                print("✗ Cognito User Pool ARN not configured")
                return False
            # Would need to create/get authorizer here
            # For now, assume authorizer exists or use AWS_IAM
        
        try:
            # Check if method already exists
            try:
                existing = self.api_client.get_method(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method
                )
                print(f"✓ Method already exists: {http_method} {path}")
                return True
            except ClientError as e:
                if e.response['Error']['Code'] != 'NotFoundException':
                    raise
            
            # Create the method
            method_config = {
                'restApiId': api_id,
                'resourceId': resource_id,
                'httpMethod': http_method,
                'authorizationType': authorization_type,
                'apiKeyRequired': api_key_required
            }
            
            if request_parameters:
                method_config['requestParameters'] = request_parameters
            
            if request_models:
                method_config['requestModels'] = request_models
            
            self.api_client.put_method(**method_config)
            print(f"✓ Added method: {http_method} {path}")
            return True
            
        except ClientError as e:
            print(f"✗ Error adding method: {e}")
            return False
    
    def remove_method(self, path: str, http_method: str) -> bool:
        """
        Remove an HTTP method from a resource.
        
        Args:
            path: The API endpoint path
            http_method: HTTP method to remove
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        resource_id = self.get_resource_id(path)
        
        if not resource_id:
            print(f"✗ Resource not found: {path}")
            return False
        
        try:
            self.api_client.delete_method(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod=http_method.upper()
            )
            print(f"✓ Removed method: {http_method} {path}")
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'NotFoundException':
                print(f"✗ Method not found: {http_method} {path}")
            else:
                print(f"✗ Error removing method: {e}")
            return False
    
    # =========================================================================
    # LAMBDA INTEGRATION
    # =========================================================================
    
    def get_lambda_arn(self, function_name: str = None) -> str:
        """
        Get Lambda function ARN.
        
        Args:
            function_name: Lambda function name (uses default if not provided)
            
        Returns:
            Lambda function ARN
        """
        function_name = function_name or LAMBDA_FUNCTION_NAME
        
        try:
            response = self.lambda_client.get_function(FunctionName=function_name)
            return response['Configuration']['FunctionArn']
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                raise ValueError(f"Lambda function '{function_name}' not found")
            raise
    
    def add_lambda_integration(
        self,
        path: str,
        http_method: str = DEFAULT_HTTP_METHOD,
        lambda_function_name: str = None,
        lambda_arn: str = None,
        integration_type: str = 'AWS_PROXY',
        request_templates: Dict = None
    ) -> bool:
        """
        Add Lambda integration to an API method.
        
        Args:
            path: The API endpoint path
            http_method: HTTP method
            lambda_function_name: Lambda function name
            lambda_arn: Lambda function ARN (alternative to function_name)
            integration_type: Integration type (AWS_PROXY, AWS)
            request_templates: Request templates for non-proxy integration
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        resource_id = self.get_resource_id(path)
        
        if not resource_id:
            print(f"✗ Resource not found: {path}")
            return False
        
        # Get Lambda ARN
        if not lambda_arn:
            lambda_arn = self.get_lambda_arn(lambda_function_name)
        
        http_method = http_method.upper()
        
        # Build URI for Lambda integration
        uri = f'arn:aws:apigateway:{self.region}:lambda:path/2015-03-31/functions/{lambda_arn}/invocations'
        
        try:
            # Check if integration already exists
            try:
                existing = self.api_client.get_integration(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method
                )
                print(f"✓ Integration already exists: {http_method} {path}")
                return True
            except ClientError as e:
                if e.response['Error']['Code'] != 'NotFoundException':
                    raise
            
            # Create integration
            integration_config = {
                'restApiId': api_id,
                'resourceId': resource_id,
                'httpMethod': http_method,
                'type': integration_type,
                'integrationHttpMethod': 'POST',
                'uri': uri
            }
            
            if integration_type != 'AWS_PROXY' and request_templates:
                integration_config['requestTemplates'] = request_templates
            
            self.api_client.put_integration(**integration_config)
            print(f"✓ Added Lambda integration: {http_method} {path} -> {lambda_arn}")
            
            # Add default integration response for non-proxy
            if integration_type != 'AWS_PROXY':
                self.api_client.put_integration_response(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod=http_method,
                    statusCode='200',
                    responseParameters={
                        'method.response.header.Access-Control-Allow-Origin': "'*'"
                    }
                )
                print(f"✓ Added integration response for: {http_method} {path}")
            
            return True
            
        except ClientError as e:
            print(f"✗ Error adding Lambda integration: {e}")
            return False
    
    def add_method_response(
        self,
        path: str,
        http_method: str = DEFAULT_HTTP_METHOD,
        status_code: str = '200',
        response_parameters: Dict = None,
        response_models: Dict = None
    ) -> bool:
        """
        Add method response configuration.
        
        Args:
            path: The API endpoint path
            http_method: HTTP method
            status_code: HTTP status code
            response_parameters: Response parameters
            response_models: Response models
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        resource_id = self.get_resource_id(path)
        
        if not resource_id:
            print(f"✗ Resource not found: {path}")
            return False
        
        try:
            config = {
                'restApiId': api_id,
                'resourceId': resource_id,
                'httpMethod': http_method.upper(),
                'statusCode': status_code
            }
            
            if response_parameters:
                config['responseParameters'] = response_parameters
            else:
                # Default CORS headers
                config['responseParameters'] = {
                    'method.response.header.Access-Control-Allow-Origin': False,
                    'method.response.header.Access-Control-Allow-Headers': False,
                    'method.response.header.Access-Control-Allow-Methods': False
                }
            
            if response_models:
                config['responseModels'] = response_models
            
            self.api_client.put_method_response(**config)
            print(f"✓ Added method response {status_code} for: {http_method} {path}")
            return True
            
        except ClientError as e:
            print(f"✗ Error adding method response: {e}")
            return False
    
    # =========================================================================
    # IAM PERMISSIONS
    # =========================================================================
    
    def add_lambda_permission(
        self,
        path: str,
        http_method: str = DEFAULT_HTTP_METHOD,
        lambda_function_name: str = None,
        statement_id: str = None
    ) -> bool:
        """
        Add permission for API Gateway to invoke Lambda function.
        
        Args:
            path: The API endpoint path
            http_method: HTTP method
            lambda_function_name: Lambda function name
            statement_id: Unique statement ID for the permission
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        function_name = lambda_function_name or LAMBDA_FUNCTION_NAME
        
        # Generate unique statement ID
        if not statement_id:
            # Create a valid statement ID from path and method
            path_clean = path.replace('/', '-').replace('{', '').replace('}', '')
            statement_id = f'api-gateway-{api_id}{path_clean}-{http_method.lower()}'
            # Limit to 64 characters and ensure valid characters
            statement_id = ''.join(c for c in statement_id if c.isalnum() or c == '-')[:64]
        
        # Build the source ARN
        source_arn = f'arn:aws:execute-api:{self.region}:{self.account_id}:{api_id}/*/{http_method.upper()}{path}'
        
        try:
            # Check if permission already exists
            try:
                policy = self.lambda_client.get_policy(FunctionName=function_name)
                policy_doc = json.loads(policy['Policy'])
                
                for statement in policy_doc.get('Statement', []):
                    if statement.get('Sid') == statement_id:
                        print(f"✓ Lambda permission already exists: {statement_id}")
                        return True
            except ClientError as e:
                if e.response['Error']['Code'] != 'ResourceNotFoundException':
                    raise
            
            # Add permission
            self.lambda_client.add_permission(
                FunctionName=function_name,
                StatementId=statement_id,
                Action='lambda:InvokeFunction',
                Principal='apigateway.amazonaws.com',
                SourceArn=source_arn
            )
            print(f"✓ Added Lambda permission: {statement_id}")
            print(f"  Source ARN: {source_arn}")
            return True
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceConflictException':
                print(f"✓ Lambda permission already exists: {statement_id}")
                return True
            print(f"✗ Error adding Lambda permission: {e}")
            return False
    
    def remove_lambda_permission(
        self,
        lambda_function_name: str = None,
        statement_id: str = None
    ) -> bool:
        """
        Remove permission for API Gateway to invoke Lambda function.
        
        Args:
            lambda_function_name: Lambda function name
            statement_id: Statement ID to remove
            
        Returns:
            True if successful, False otherwise
        """
        function_name = lambda_function_name or LAMBDA_FUNCTION_NAME
        
        if not statement_id:
            print("✗ Statement ID required to remove permission")
            return False
        
        try:
            self.lambda_client.remove_permission(
                FunctionName=function_name,
                StatementId=statement_id
            )
            print(f"✓ Removed Lambda permission: {statement_id}")
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                print(f"✗ Permission not found: {statement_id}")
            else:
                print(f"✗ Error removing Lambda permission: {e}")
            return False
    
    # =========================================================================
    # CORS CONFIGURATION
    # =========================================================================
    
    def enable_cors(
        self,
        path: str,
        allow_origins: str = CORS_ALLOW_ORIGINS,
        allow_methods: str = CORS_ALLOW_METHODS,
        allow_headers: str = CORS_ALLOW_HEADERS
    ) -> bool:
        """
        Enable CORS for a resource by adding OPTIONS method.
        
        Args:
            path: The API endpoint path
            allow_origins: Allowed origins
            allow_methods: Allowed methods
            allow_headers: Allowed headers
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        resource_id = self.get_resource_id(path)
        
        if not resource_id:
            print(f"✗ Resource not found: {path}")
            return False
        
        try:
            # Add OPTIONS method
            try:
                self.api_client.put_method(
                    restApiId=api_id,
                    resourceId=resource_id,
                    httpMethod='OPTIONS',
                    authorizationType='NONE'
                )
                print(f"✓ Added OPTIONS method for CORS: {path}")
            except ClientError as e:
                if e.response['Error']['Code'] != 'ConflictException':
                    raise
                print(f"✓ OPTIONS method already exists: {path}")
            
            # Add mock integration for OPTIONS
            self.api_client.put_integration(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod='OPTIONS',
                type='MOCK',
                requestTemplates={
                    'application/json': '{"statusCode": 200}'
                }
            )
            print(f"✓ Added mock integration for OPTIONS: {path}")
            
            # Add method response
            self.api_client.put_method_response(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod='OPTIONS',
                statusCode='200',
                responseParameters={
                    'method.response.header.Access-Control-Allow-Origin': False,
                    'method.response.header.Access-Control-Allow-Methods': False,
                    'method.response.header.Access-Control-Allow-Headers': False
                }
            )
            
            # Add integration response
            self.api_client.put_integration_response(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod='OPTIONS',
                statusCode='200',
                responseParameters={
                    'method.response.header.Access-Control-Allow-Origin': allow_origins,
                    'method.response.header.Access-Control-Allow-Methods': allow_methods,
                    'method.response.header.Access-Control-Allow-Headers': allow_headers
                }
            )
            print(f"✓ CORS enabled for: {path}")
            return True
            
        except ClientError as e:
            print(f"✗ Error enabling CORS: {e}")
            return False
    
    # =========================================================================
    # CLOUDWATCH LOGGING
    # =========================================================================
    
    def get_or_create_log_group(self, log_group_name: str) -> bool:
        """
        Get or create CloudWatch log group.
        
        Args:
            log_group_name: Name of the log group
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Check if log group exists
            response = self.logs_client.describe_log_groups(
                logGroupNamePrefix=log_group_name
            )
            
            for group in response.get('logGroups', []):
                if group['logGroupName'] == log_group_name:
                    print(f"✓ Log group exists: {log_group_name}")
                    return True
            
            # Create log group
            self.logs_client.create_log_group(logGroupName=log_group_name)
            self.logs_client.put_retention_policy(
                logGroupName=log_group_name,
                retentionInDays=LOG_RETENTION_DAYS
            )
            print(f"✓ Created log group: {log_group_name}")
            return True
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceAlreadyExistsException':
                print(f"✓ Log group already exists: {log_group_name}")
                return True
            print(f"✗ Error creating log group: {e}")
            return False
    
    def get_or_create_cloudwatch_role(self) -> Optional[str]:
        """
        Get or create IAM role for API Gateway CloudWatch logging.
        
        Returns:
            Role ARN or None if failed
        """
        role_name = API_GATEWAY_CLOUDWATCH_ROLE_NAME
        
        assume_role_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {
                        "Service": "apigateway.amazonaws.com"
                    },
                    "Action": "sts:AssumeRole"
                }
            ]
        }
        
        try:
            # Check if role exists
            try:
                response = self.iam_client.get_role(RoleName=role_name)
                print(f"✓ IAM role exists: {role_name}")
                return response['Role']['Arn']
            except ClientError as e:
                if e.response['Error']['Code'] != 'NoSuchEntity':
                    raise
            
            # Create role
            response = self.iam_client.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=json.dumps(assume_role_policy),
                Description='Role for API Gateway CloudWatch logging'
            )
            role_arn = response['Role']['Arn']
            
            # Attach CloudWatch logs policy
            policy_document = {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Action": [
                            "logs:CreateLogGroup",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents",
                            "logs:DescribeLogStreams"
                        ],
                        "Resource": f"arn:aws:logs:{self.region}:{self.account_id}:log-group:*"
                    }
                ]
            }
            
            self.iam_client.put_role_policy(
                RoleName=role_name,
                PolicyName=f'{role_name}-policy',
                PolicyDocument=json.dumps(policy_document)
            )
            
            print(f"✓ Created IAM role: {role_name}")
            print(f"  ARN: {role_arn}")
            
            # Wait for role propagation
            print("  Waiting for IAM propagation (10 seconds)...")
            time.sleep(10)
            
            return role_arn
            
        except ClientError as e:
            print(f"✗ Error creating IAM role: {e}")
            return None
    
    def enable_logging(
        self,
        stage_name: str = DEFAULT_STAGE_NAME,
        log_level: str = LOG_LEVEL
    ) -> bool:
        """
        Enable CloudWatch logging for API Gateway stage.
        
        Args:
            stage_name: API Gateway stage name
            log_level: Log level (OFF, ERROR, INFO)
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        
        # Create log group
        log_group_name = f"{LOG_GROUP_NAME_PREFIX}_{api_id}/{stage_name}"
        self.get_or_create_log_group(log_group_name)
        
        # Get or create CloudWatch role
        role_arn = self.get_or_create_cloudwatch_role()
        if not role_arn:
            return False
        
        try:
            # Update stage to enable logging
            self.api_client.update_stage(
                restApiId=api_id,
                stageName=stage_name,
                patchOperations=[
                    {
                        'op': 'replace',
                        'path': '/cloudwatchRoleArn',
                        'value': role_arn
                    },
                    {
                        'op': 'replace',
                        'path': '/*/*/logging/loglevel',
                        'value': log_level
                    },
                    {
                        'op': 'replace',
                        'path': '/*/*/logging/dataTrace',
                        'value': 'true'
                    },
                    {
                        'op': 'replace',
                        'path': '/*/*/metrics/enabled',
                        'value': 'true'
                    }
                ]
            )
            
            print(f"✓ Enabled CloudWatch logging for stage: {stage_name}")
            print(f"  Log Group: {log_group_name}")
            print(f"  Log Level: {log_level}")
            return True
            
        except ClientError as e:
            print(f"✗ Error enabling logging: {e}")
            return False
    
    # =========================================================================
    # DEPLOYMENT
    # =========================================================================
    
    def deploy_api(self, stage_name: str = DEFAULT_STAGE_NAME) -> bool:
        """
        Deploy the API to a stage.
        
        Args:
            stage_name: Stage name to deploy to
            
        Returns:
            True if successful, False otherwise
        """
        api_id = self.get_api_id()
        
        try:
            response = self.api_client.create_deployment(
                restApiId=api_id,
                stageName=stage_name,
                description=DEPLOYMENT_DESCRIPTION
            )
            
            print(f"✓ Deployed API to stage: {stage_name}")
            print(f"  Deployment ID: {response['id']}")
            print(f"  API URL: https://{api_id}.execute-api.{self.region}.amazonaws.com/{stage_name}")
            return True
            
        except ClientError as e:
            print(f"✗ Error deploying API: {e}")
            return False
    
    # =========================================================================
    # VIEWING CHANGES
    # =========================================================================
    
    def list_endpoints(self) -> List[Dict]:
        """
        List all endpoints in the API.
        
        Returns:
            List of endpoint information
        """
        api_id = self.get_api_id()
        resources = self.api_client.get_resources(restApiId=api_id)
        
        endpoints = []
        
        for resource in resources.get('items', []):
            path = resource['path']
            methods = resource.get('resourceMethods', {})
            
            if methods:
                for method, method_info in methods.items():
                    endpoint = {
                        'path': path,
                        'method': method,
                        'auth_type': method_info.get('authorizationType', 'NONE'),
                        'api_key_required': method_info.get('apiKeyRequired', False)
                    }
                    
                    # Get integration info
                    try:
                        integration = self.api_client.get_integration(
                            restApiId=api_id,
                            resourceId=resource['id'],
                            httpMethod=method
                        )
                        endpoint['integration_type'] = integration.get('type', 'N/A')
                        endpoint['integration_uri'] = integration.get('uri', 'N/A')
                    except ClientError:
                        endpoint['integration_type'] = 'None'
                        endpoint['integration_uri'] = 'N/A'
                    
                    endpoints.append(endpoint)
        
        return endpoints
    
    def show_api_info(self) -> None:
        """Display API information and all endpoints."""
        api_id = self.get_api_id()
        
        try:
            api_info = self.api_client.get_rest_api(restApiId=api_id)
            
            print("\n" + "=" * 70)
            print("API GATEWAY INFORMATION")
            print("=" * 70)
            print(f"API Name: {api_info['name']}")
            print(f"API ID: {api_id}")
            print(f"Description: {api_info.get('description', 'N/A')}")
            print(f"Created: {api_info['createdDate']}")
            print(f"Region: {self.region}")
            print("=" * 70)
            
            # List endpoints
            endpoints = self.list_endpoints()
            
            if endpoints:
                print("\nENDPOINTS:")
                print("-" * 70)
                
                for endpoint in endpoints:
                    print(f"\n  {endpoint['method']} {endpoint['path']}")
                    print(f"    Auth Type: {endpoint['auth_type']}")
                    print(f"    API Key Required: {endpoint['api_key_required']}")
                    print(f"    Integration Type: {endpoint['integration_type']}")
                    if endpoint['integration_uri'] != 'N/A':
                        # Truncate URI for display
                        uri = endpoint['integration_uri']
                        if len(uri) > 60:
                            uri = uri[:57] + "..."
                        print(f"    Integration URI: {uri}")
            else:
                print("\nNo endpoints configured.")
            
            print("\n" + "=" * 70)
            
        except ClientError as e:
            print(f"✗ Error getting API info: {e}")
    
    def show_stage_info(self, stage_name: str = DEFAULT_STAGE_NAME) -> None:
        """Display stage information including logging settings."""
        api_id = self.get_api_id()
        
        try:
            stage = self.api_client.get_stage(restApiId=api_id, stageName=stage_name)
            
            print("\n" + "=" * 70)
            print(f"STAGE INFORMATION: {stage_name}")
            print("=" * 70)
            print(f"Stage Name: {stage['stageName']}")
            print(f"Description: {stage.get('description', 'N/A')}")
            print(f"Created: {stage.get('createdDate', 'N/A')}")
            print(f"Last Updated: {stage.get('lastUpdatedDate', 'N/A')}")
            
            # Logging settings
            method_settings = stage.get('methodSettings', {})
            if method_settings:
                print("\nLOGGING SETTINGS:")
                print("-" * 40)
                for setting_path, settings in method_settings.items():
                    print(f"  Path: {setting_path}")
                    print(f"    Log Level: {settings.get('loggingLevel', 'OFF')}")
                    print(f"    Data Trace: {settings.get('dataTraceEnabled', False)}")
                    print(f"    Metrics Enabled: {settings.get('metricsEnabled', False)}")
            
            # CloudWatch role
            cw_role = stage.get('cloudwatchRoleArn')
            if cw_role:
                print(f"\nCloudWatch Role: {cw_role}")
            
            print("=" * 70)
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NotFoundException':
                print(f"✗ Stage '{stage_name}' not found. Deploy the API first.")
            else:
                print(f"✗ Error getting stage info: {e}")
    
    # =========================================================================
    # HIGH-LEVEL OPERATIONS
    # =========================================================================
    
    def add_endpoint(
        self,
        path: str,
        http_method: str = DEFAULT_HTTP_METHOD,
        lambda_function_name: str = None,
        enable_cors: bool = ENABLE_CORS,
        auth_type: str = DEFAULT_AUTH_TYPE,
        api_key_required: bool = False,
        stage_name: str = DEFAULT_STAGE_NAME,
        enable_logging: bool = True
    ) -> bool:
        """
        Add a complete endpoint with Lambda integration.
        
        This is a high-level method that:
        1. Creates the resource
        2. Adds the HTTP method
        3. Adds Lambda integration
        4. Adds Lambda permission
        5. Optionally enables CORS
        6. Optionally enables logging
        7. Deploys the API
        
        Args:
            path: The API endpoint path
            http_method: HTTP method
            lambda_function_name: Lambda function name
            enable_cors: Whether to enable CORS
            auth_type: Authorization type
            api_key_required: Whether API key is required
            stage_name: Stage name for deployment
            enable_logging: Whether to enable logging
            
        Returns:
            True if successful, False otherwise
        """
        print("\n" + "=" * 70)
        print(f"ADDING ENDPOINT: {http_method} {path}")
        print("=" * 70)
        
        # Step 1: Create resource
        print("\n[1/7] Creating resource...")
        resource_id = self.get_or_create_resource(path)
        if not resource_id:
            return False
        
        # Step 2: Add method
        print("\n[2/7] Adding HTTP method...")
        if not self.add_method(path, http_method, auth_type, api_key_required):
            return False
        
        # Step 3: Add Lambda integration
        print("\n[3/7] Adding Lambda integration...")
        if not self.add_lambda_integration(path, http_method, lambda_function_name):
            return False
        
        # Step 4: Add method response
        print("\n[4/7] Adding method response...")
        if not self.add_method_response(path, http_method):
            return False
        
        # Step 5: Add Lambda permission
        print("\n[5/7] Adding Lambda permission...")
        if not self.add_lambda_permission(path, http_method, lambda_function_name):
            return False
        
        # Step 6: Enable CORS
        if enable_cors:
            print("\n[6/7] Enabling CORS...")
            if not self.enable_cors(path):
                print("  Warning: CORS setup failed, continuing...")
        
        # Step 7: Enable logging
        if enable_logging:
            print("\n[7/7] Enabling logging...")
            if not self.enable_logging(stage_name):
                print("  Warning: Logging setup failed, continuing...")
        
        # Deploy
        print("\n[DEPLOY] Deploying API...")
        if not self.deploy_api(stage_name):
            return False
        
        print("\n" + "=" * 70)
        print("✓ ENDPOINT ADDED SUCCESSFULLY")
        print("=" * 70)
        print(f"  Path: {path}")
        print(f"  Method: {http_method}")
        print(f"  Stage: {stage_name}")
        print(f"  URL: https://{self.get_api_id()}.execute-api.{self.region}.amazonaws.com/{stage_name}{path}")
        print("=" * 70)
        
        return True
    
    def remove_endpoint(
        self,
        path: str,
        http_method: str = None,
        stage_name: str = DEFAULT_STAGE_NAME
    ) -> bool:
        """
        Remove an endpoint from the API.
        
        Args:
            path: The API endpoint path
            http_method: HTTP method (if None, removes entire resource)
            stage_name: Stage name for deployment
            
        Returns:
            True if successful, False otherwise
        """
        print("\n" + "=" * 70)
        if http_method:
            print(f"REMOVING ENDPOINT: {http_method} {path}")
        else:
            print(f"REMOVING RESOURCE: {path}")
        print("=" * 70)
        
        if http_method:
            # Remove specific method
            if not self.remove_method(path, http_method):
                return False
        else:
            # Remove entire resource
            if not self.delete_resource(path):
                return False
        
        # Deploy changes
        print("\n[DEPLOY] Deploying API...")
        if not self.deploy_api(stage_name):
            return False
        
        print("\n" + "=" * 70)
        print("✓ ENDPOINT REMOVED SUCCESSFULLY")
        print("=" * 70)
        
        return True


def list_available_apis(region: str) -> None:
    """List all available API Gateway APIs in the region."""
    api_client = boto3.client('apigateway', region_name=region)
    
    print("\n" + "=" * 70)
    print("AVAILABLE API GATEWAY APIS")
    print("=" * 70)
    
    try:
        response = api_client.get_rest_apis()
        apis = response.get('items', [])
        
        if not apis:
            print("No API Gateway APIs found in this region.")
            print("\nTo create a new API, run:")
            print("  aws apigateway create-rest-api --name 'my-api' --region {region}")
        else:
            for api in apis:
                print(f"\n  Name: {api['name']}")
                print(f"  ID: {api['id']}")
                print(f"  Created: {api['createdDate']}")
                if api.get('description'):
                    print(f"  Description: {api['description']}")
        
        print("\n" + "=" * 70)
        print("USAGE:")
        print("  python endpoint_management.py --api-id <API_ID> --show-info")
        print("  python endpoint_management.py --api-name <API_NAME> --show-info")
        print("=" * 70)
        
    except ClientError as e:
        print(f"Error listing APIs: {e}")


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description='Manage API Gateway endpoints with Lambda integration',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List available APIs
  python endpoint_management.py --list-apis

  # Show API information
  python endpoint_management.py --api-id abc123 --show-info

  # Add an endpoint
  python endpoint_management.py --api-id abc123 --add-endpoint --path /api/v1/users --method POST

  # Add endpoint with specific Lambda function
  python endpoint_management.py --api-id abc123 --add-endpoint --path /api/v1/data --method GET --lambda my-function

  # Remove an endpoint
  python endpoint_management.py --api-id abc123 --remove-endpoint --path /api/v1/users --method POST

  # Remove entire resource
  python endpoint_management.py --api-id abc123 --remove-endpoint --path /api/v1/users

  # Enable logging
  python endpoint_management.py --api-id abc123 --enable-logging --stage prod

  # Deploy API
  python endpoint_management.py --api-id abc123 --deploy --stage prod
        """
    )
    
    # API identification
    parser.add_argument('--api-id', help='API Gateway ID')
    parser.add_argument('--api-name', help='API Gateway name (alternative to --api-id)')
    parser.add_argument('--region', default=REGION, help='AWS region')
    
    # Operations
    parser.add_argument('--list-apis', action='store_true', help='List all available APIs')
    parser.add_argument('--show-info', action='store_true', help='Show API information')
    parser.add_argument('--show-stage', action='store_true', help='Show stage information')
    parser.add_argument('--add-endpoint', action='store_true', help='Add an endpoint')
    parser.add_argument('--remove-endpoint', action='store_true', help='Remove an endpoint')
    parser.add_argument('--enable-logging', action='store_true', help='Enable CloudWatch logging')
    parser.add_argument('--deploy', action='store_true', help='Deploy the API')
    
    # Endpoint configuration
    parser.add_argument('--path', help='Endpoint path (e.g., /api/v1/resource)')
    parser.add_argument('--method', default=None, help='HTTP method (if not specified for remove-endpoint, removes entire resource)')
    parser.add_argument('--lambda', dest='lambda_function', help='Lambda function name')
    parser.add_argument('--stage', default=DEFAULT_STAGE_NAME, help='Stage name')
    
    # Optional flags
    parser.add_argument('--no-cors', action='store_true', help='Disable CORS')
    parser.add_argument('--auth-type', default=DEFAULT_AUTH_TYPE, 
                        choices=['NONE', 'AWS_IAM', 'COGNITO_USER_POOLS'],
                        help='Authorization type')
    parser.add_argument('--require-api-key', action='store_true', help='Require API key')
    
    args = parser.parse_args()
    
    # List APIs operation doesn't need API ID
    if args.list_apis:
        list_available_apis(args.region)
        return
    
    # Determine API ID/name
    api_id = args.api_id
    api_name = args.api_name
    
    # Only use config defaults if they are valid (not placeholder values)
    if not api_id and not api_name:
        if API_ID and API_ID != 'your-api-id-here' and not API_ID.startswith('your-'):
            api_id = API_ID
        elif API_NAME:
            api_name = API_NAME
    
    if not api_id and not api_name:
        print("Error: Either --api-id or --api-name must be provided.")
        print("\nUse --list-apis to see available APIs:")
        print("  python endpoint_management.py --list-apis")
        print("\nOr specify an API:")
        print("  python endpoint_management.py --api-id <API_ID> --show-info")
        print("  python endpoint_management.py --api-name <API_NAME> --show-info")
        sys.exit(1)
    
    # Initialize manager
    manager = EndpointManager(
        api_id=api_id,
        api_name=api_name,
        region=args.region
    )
    
    try:
        # Execute requested operation
        if args.show_info:
            manager.show_api_info()
        
        elif args.show_stage:
            manager.show_stage_info(args.stage)
        
        elif args.add_endpoint:
            if not args.path:
                print("Error: --path is required for adding an endpoint")
                sys.exit(1)
            
            # Use default method if not specified
            http_method = args.method if args.method else DEFAULT_HTTP_METHOD
            
            success = manager.add_endpoint(
                path=args.path,
                http_method=http_method,
                lambda_function_name=args.lambda_function,
                enable_cors=not args.no_cors,
                auth_type=args.auth_type,
                api_key_required=args.require_api_key,
                stage_name=args.stage
            )
            sys.exit(0 if success else 1)
        
        elif args.remove_endpoint:
            if not args.path:
                print("Error: --path is required for removing an endpoint")
                sys.exit(1)
            
            success = manager.remove_endpoint(
                path=args.path,
                http_method=args.method,
                stage_name=args.stage
            )
            sys.exit(0 if success else 1)
        
        elif args.enable_logging:
            success = manager.enable_logging(args.stage)
            sys.exit(0 if success else 1)
        
        elif args.deploy:
            success = manager.deploy_api(args.stage)
            sys.exit(0 if success else 1)
        
        else:
            # Default: show info
            manager.show_api_info()
    
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
