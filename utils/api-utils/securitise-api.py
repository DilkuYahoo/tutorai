#!/usr/bin/env python3
"""
AWS API Gateway Security Script
Adds Usage Plan (rate + quota), API Key requirement, CloudWatch logging, and Cognito authentication to existing APIs.

Note: API keys must be created separately in AWS Console or via other tools.

This script is idempotent - running it multiple times won't create duplicate resources.

Cognito Authentication:
- If a Cognito User Pool ID is provided, the script will use it for authentication
- If the User Pool ID doesn't exist, a new User Pool will be created
- The authorizer can be attached to specific endpoints and methods
"""

import boto3
import json
import argparse
import time
from botocore.exceptions import ClientError


# ==================== DEFAULT CONFIGURATION ====================
# Modify these values as needed
DEFAULT_REGION = 'ap-southeast-2'
DEFAULT_API_KEY_NAME = 'default-api-key'
DEFAULT_USAGE_PLAN_NAME = 'default-usage-plan'
DEFAULT_RATE_LIMIT = 2  # requests per second
DEFAULT_QUOTA_LIMIT = 1500  # requests per month
DEFAULT_STAGES = 'prod,dev'
DEFAULT_USAGE_PLAN_DESCRIPTION = 'Auto-generated usage plan'
DEFAULT_LOGGING_RETENTION_DAYS = 30

# Cognito defaults
DEFAULT_COGNITO_USER_POOL_NAME = 'APIGatewayUserPool'
DEFAULT_COGNITO_APP_CLIENT_NAME = 'APIGatewayClient'
DEFAULT_COGNITO_DOMAIN_PREFIX = 'api-gateway-auth'
DEFAULT_AUTHORIZER_NAME = 'CognitoAuthorizer'
# =============================================================


class APIGatewaySecuritizer:
    """Securitize API Gateway with API keys, usage plans, CloudWatch logging, and Cognito authentication."""
    
    def __init__(self, api_name=None, api_id=None, region=DEFAULT_REGION):
        self.region = region
        self.api_name = api_name
        self.api_id = api_id
        self.api_client = boto3.client('apigateway', region_name=region)
        self.cw_client = boto3.client('logs', region_name=region)
        self.iam_client = boto3.client('iam', region_name=region)
        self.sts_client = boto3.client('sts', region_name=region)
        self.cognito_client = boto3.client('cognito-idp', region_name=region)
        
    def get_account_id(self):
        """Get AWS account ID."""
        identity = self.sts_client.get_caller_identity()
        return identity['Account']
    
    def find_api_by_name(self, api_name):
        """Find API ID by API name."""
        try:
            response = self.api_client.get_rest_apis()
            for api in response.get('items', []):
                if api['name'] == api_name:
                    return api['id']
            return None
        except ClientError as e:
            print(f"Error finding API: {e}")
            return None
    
    def get_api_id(self):
        """Get API ID from name or ID."""
        if self.api_id:
            return self.api_id
        if self.api_name:
            self.api_id = self.find_api_by_name(self.api_name)
            if not self.api_id:
                raise ValueError(f"API '{self.api_name}' not found")
            return self.api_id
        raise ValueError("Either api_name or api_id must be provided")
    
    # ==================== COGNITO USER POOL MANAGEMENT ====================
    
    def check_user_pool_exists(self, user_pool_id):
        """
        Check if a Cognito User Pool exists by ID.
        Returns True if exists, False otherwise.
        """
        try:
            self.cognito_client.describe_user_pool(UserPoolId=user_pool_id)
            print(f"User Pool '{user_pool_id}' exists")
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                print(f"User Pool '{user_pool_id}' not found")
                return False
            print(f"Error checking User Pool: {e}")
            raise
    
    def find_user_pool_by_name(self, pool_name):
        """
        Find a User Pool ID by name.
        Returns the Pool ID if found, None otherwise.
        """
        try:
            response = self.cognito_client.list_user_pools(MaxResults=60)
            for pool in response.get('UserPools', []):
                if pool['Name'] == pool_name:
                    return pool['Id']
            return None
        except ClientError as e:
            print(f"Error listing User Pools: {e}")
            return None
    
    def create_user_pool(self, pool_name=None, domain_prefix=None):
        """
        Create a new Cognito User Pool.
        
        Args:
            pool_name: Name for the User Pool (default: DEFAULT_COGNITO_USER_POOL_NAME)
            domain_prefix: Domain prefix for hosted UI (must be globally unique)
        
        Returns:
            User Pool ID
        """
        if pool_name is None:
            pool_name = DEFAULT_COGNITO_USER_POOL_NAME
        
        try:
            print(f"Creating Cognito User Pool: {pool_name}")
            
            response = self.cognito_client.create_user_pool(
                PoolName=pool_name,
                AutoVerifiedAttributes=['email'],
                UsernameAttributes=['email'],
                Policies={
                    'PasswordPolicy': {
                        'MinimumLength': 8,
                        'RequireUppercase': True,
                        'RequireLowercase': True,
                        'RequireNumbers': True,
                        'RequireSymbols': True,
                    }
                },
                AccountRecoverySetting={
                    'RecoveryMechanisms': [{'Name': 'verified_email', 'Priority': 1}]
                },
                Schema=[
                    {
                        'Name': 'email',
                        'AttributeDataType': 'String',
                        'Required': True,
                        'Mutable': True,
                    }
                ]
            )
            
            user_pool_id = response['UserPool']['Id']
            print(f"User Pool created: {user_pool_id}")
            
            # Create domain if prefix provided
            if domain_prefix:
                self.create_user_pool_domain(user_pool_id, domain_prefix)
            
            return user_pool_id
            
        except ClientError as e:
            print(f"Error creating User Pool: {e}")
            raise
    
    def create_user_pool_domain(self, user_pool_id, domain_prefix):
        """Create a domain for the User Pool (for hosted UI)."""
        try:
            print(f"Creating User Pool domain: {domain_prefix}")
            self.cognito_client.create_user_pool_domain(
                Domain=domain_prefix,
                UserPoolId=user_pool_id
            )
            print(f"Domain created: https://{domain_prefix}.auth.{self.region}.amazoncognito.com")
            
            # Wait for domain to become active
            time.sleep(5)
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'InvalidParameterException' and 'already exists' in str(e):
                print(f"Domain '{domain_prefix}' already exists (may be owned by another account)")
            else:
                print(f"Error creating domain: {e}")
    
    def get_or_create_user_pool(self, user_pool_id=None, pool_name=None, domain_prefix=None):
        """
        Get existing User Pool or create a new one.
        
        Args:
            user_pool_id: Existing User Pool ID (if provided, will verify it exists)
            pool_name: Name for new User Pool (used if user_pool_id not provided or doesn't exist)
            domain_prefix: Domain prefix for hosted UI (for new pools)
        
        Returns:
            User Pool ID
        """
        # If user_pool_id provided, check if it exists
        if user_pool_id:
            if self.check_user_pool_exists(user_pool_id):
                return user_pool_id
            print(f"User Pool ID '{user_pool_id}' not found, will create new pool")
        
        # Use default pool name if not provided
        if pool_name is None:
            pool_name = DEFAULT_COGNITO_USER_POOL_NAME
        
        # Check if pool with this name already exists
        existing_pool_id = self.find_user_pool_by_name(pool_name)
        if existing_pool_id:
            print(f"Found existing User Pool with name '{pool_name}': {existing_pool_id}")
            return existing_pool_id
        
        # Create new pool
        return self.create_user_pool(pool_name=pool_name, domain_prefix=domain_prefix)
    
    def get_user_pool_arn(self, user_pool_id):
        """Get the ARN of a User Pool."""
        account_id = self.get_account_id()
        return f"arn:aws:cognito-idp:{self.region}:{account_id}:userpool/{user_pool_id}"
    
    # ==================== COGNITO APP CLIENT MANAGEMENT ====================
    
    def find_app_client(self, user_pool_id, client_name):
        """Find an App Client ID by name."""
        try:
            response = self.cognito_client.list_user_pool_clients(
                UserPoolId=user_pool_id,
                MaxResults=60
            )
            for client in response.get('UserPoolClients', []):
                if client['ClientName'] == client_name:
                    return client['ClientId']
            return None
        except ClientError as e:
            print(f"Error listing App Clients: {e}")
            return None
    
    def create_app_client(self, user_pool_id, client_name=None, callback_urls=None, logout_urls=None):
        """
        Create an App Client for the User Pool.
        
        Args:
            user_pool_id: User Pool ID
            client_name: Name for the App Client
            callback_urls: List of callback URLs for OAuth
            logout_urls: List of logout URLs for OAuth
        
        Returns:
            App Client ID
        """
        if client_name is None:
            client_name = DEFAULT_COGNITO_APP_CLIENT_NAME
        
        if callback_urls is None:
            callback_urls = ['http://localhost:3000/']
        
        if logout_urls is None:
            logout_urls = ['http://localhost:3000/']
        
        try:
            # Check if client already exists
            existing_client = self.find_app_client(user_pool_id, client_name)
            if existing_client:
                print(f"App Client '{client_name}' already exists: {existing_client}")
                return existing_client
            
            print(f"Creating App Client: {client_name}")
            response = self.cognito_client.create_user_pool_client(
                UserPoolId=user_pool_id,
                ClientName=client_name,
                GenerateSecret=False,
                AllowedOAuthFlowsUserPoolClient=True,
                AllowedOAuthFlows=['code'],
                AllowedOAuthScopes=['openid', 'email', 'profile'],
                CallbackURLs=callback_urls,
                LogoutURLs=logout_urls,
                SupportedIdentityProviders=['COGNITO'],
            )
            
            client_id = response['UserPoolClient']['ClientId']
            print(f"App Client created: {client_id}")
            return client_id
            
        except ClientError as e:
            print(f"Error creating App Client: {e}")
            raise
    
    # ==================== COGNITO AUTHORIZER FOR API GATEWAY ====================
    
    def get_authorizer(self, api_id, authorizer_name):
        """
        Get an existing authorizer by name.
        Returns authorizer ID if found, None otherwise.
        """
        try:
            response = self.api_client.get_authorizers(restApiId=api_id)
            for auth in response.get('items', []):
                if auth['name'] == authorizer_name:
                    return auth['id']
            return None
        except ClientError as e:
            print(f"Error getting authorizers: {e}")
            return None
    
    def create_cognito_authorizer(self, api_id, user_pool_id, authorizer_name=None):
        """
        Create a Cognito User Pool authorizer for API Gateway.
        
        Args:
            api_id: API Gateway ID
            user_pool_id: Cognito User Pool ID
            authorizer_name: Name for the authorizer
        
        Returns:
            Authorizer ID
        """
        if authorizer_name is None:
            authorizer_name = DEFAULT_AUTHORIZER_NAME
        
        # Check if authorizer already exists
        existing_auth_id = self.get_authorizer(api_id, authorizer_name)
        if existing_auth_id:
            print(f"Authorizer '{authorizer_name}' already exists: {existing_auth_id}")
            return existing_auth_id
        
        user_pool_arn = self.get_user_pool_arn(user_pool_id)
        
        try:
            print(f"Creating Cognito authorizer: {authorizer_name}")
            response = self.api_client.create_authorizer(
                restApiId=api_id,
                name=authorizer_name,
                type='COGNITO_USER_POOLS',
                providerARNs=[user_pool_arn],
                identitySource='method.request.header.Authorization'
            )
            
            authorizer_id = response['id']
            print(f"Authorizer created: {authorizer_id}")
            return authorizer_id
            
        except ClientError as e:
            print(f"Error creating authorizer: {e}")
            raise
    
    def attach_authorizer_to_method(self, api_id, resource_path, http_method, authorizer_id):
        """
        Attach a Cognito authorizer to a specific method.
        
        Args:
            api_id: API Gateway ID
            resource_path: Resource path (e.g., '/api/v1/users')
            http_method: HTTP method (e.g., 'GET', 'POST')
            authorizer_id: Authorizer ID
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get resource ID from path
            resources = self.api_client.get_resources(restApiId=api_id)
            resource_id = None
            
            for resource in resources.get('items', []):
                if resource['path'] == resource_path:
                    resource_id = resource['id']
                    break
            
            if not resource_id:
                print(f"Resource path '{resource_path}' not found")
                return False
            
            # Update method to use the authorizer
            self.api_client.update_method(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod=http_method,
                patchOperations=[
                    {
                        'op': 'replace',
                        'path': '/authorizationType',
                        'value': 'COGNITO_USER_POOLS'
                    },
                    {
                        'op': 'replace',
                        'path': '/authorizerId',
                        'value': authorizer_id
                    }
                ]
            )
            
            print(f"Attached authorizer to {http_method} {resource_path}")
            return True
            
        except ClientError as e:
            print(f"Error attaching authorizer to method: {e}")
            return False
    
    def attach_authorizer_to_all_methods(self, api_id, authorizer_id, exclude_paths=None):
        """
        Attach a Cognito authorizer to all methods in the API.
        
        Args:
            api_id: API Gateway ID
            authorizer_id: Authorizer ID
            exclude_paths: List of paths to exclude (e.g., ['/health', '/public'])
        
        Returns:
            Number of methods updated
        """
        if exclude_paths is None:
            exclude_paths = []
        
        try:
            resources = self.api_client.get_resources(restApiId=api_id)
            methods_updated = 0
            
            for resource in resources.get('items', []):
                resource_path = resource['path']
                
                # Skip excluded paths
                if resource_path in exclude_paths:
                    print(f"Skipping excluded path: {resource_path}")
                    continue
                
                if 'resourceMethods' not in resource:
                    continue
                
                for method in resource['resourceMethods'].keys():
                    if method == 'OPTIONS':  # Skip OPTIONS (CORS)
                        continue
                    
                    success = self.attach_authorizer_to_method(
                        api_id, resource_path, method, authorizer_id
                    )
                    if success:
                        methods_updated += 1
            
            print(f"Updated {methods_updated} methods with Cognito authorizer")
            return methods_updated
            
        except ClientError as e:
            print(f"Error attaching authorizer to all methods: {e}")
            return 0
    
    # ==================== API KEY MANAGEMENT ====================
    
    def get_api_key_id(self, api_key_name):
        """
        Get existing API key ID by name.
        Returns None if API key doesn't exist (doesn't create new ones).
        """
        try:
            response = self.api_client.get_api_keys()
            for key in response.get('items', []):
                if key['name'] == api_key_name:
                    print(f"Found API key: {api_key_name}")
                    return key['id']
            print(f"API key '{api_key_name}' not found. Create it in AWS Console first.")
            return None
        except ClientError as e:
            print(f"Error fetching API keys: {e}")
            return None
    
    # ==================== USAGE PLAN MANAGEMENT ====================
    
    def get_or_create_usage_plan(self, usage_plan_name, description, rate_limit, quota_limit):
        """
        Get existing usage plan or create a new one (idempotent).
        rate_limit: Requests per second (e.g., 100)
        quota_limit: Requests per month (e.g., 10000)
        """
        # Check for existing usage plan with the same name
        try:
            response = self.api_client.get_usage_plans()
            for plan in response.get('items', []):
                if plan['name'] == usage_plan_name:
                    print(f"Found existing usage plan: {usage_plan_name}")
                    return self.update_usage_plan(
                        plan['id'],
                        description=description,
                        rate_limit=rate_limit,
                        quota_limit=quota_limit
                    )
        except ClientError as e:
            print(f"Error fetching usage plans: {e}")
        
        # Create new usage plan
        try:
            print(f"Creating new usage plan: {usage_plan_name}")
            response = self.api_client.create_usage_plan(
                name=usage_plan_name,
                description=description,
                throttle={
                    'rateLimit': rate_limit,
                    'burstLimit': rate_limit  # Same as rate for simplicity
                },
                quota={
                    'limit': quota_limit,
                    'period': 'MONTH'
                }
            )
            usage_plan_id = response['id']
            print(f"Usage plan created successfully: {usage_plan_name}")
            return usage_plan_id
        except ClientError as e:
            print(f"Error creating usage plan: {e}")
            raise
    
    def update_usage_plan(self, usage_plan_id, description=None, rate_limit=None, quota_limit=None):
        """Update an existing usage plan."""
        patch_ops = []
        
        if description:
            patch_ops.append({'op': 'replace', 'path': '/description', 'value': description})
        
        if rate_limit:
            patch_ops.append({'op': 'replace', 'path': '/throttle/rateLimit', 'value': str(rate_limit)})
            patch_ops.append({'op': 'replace', 'path': '/throttle/burstLimit', 'value': str(rate_limit)})
        
        if quota_limit:
            patch_ops.append({'op': 'replace', 'path': '/quota/limit', 'value': str(quota_limit)})
        
        if patch_ops:
            try:
                self.api_client.update_usage_plan(
                    usagePlanId=usage_plan_id,
                    patchOperations=patch_ops
                )
                print(f"Usage plan updated: {usage_plan_id}")
            except ClientError as e:
                print(f"Error updating usage plan: {e}")
        
        return usage_plan_id
    
    def associate_api_with_usage_plan(self, usage_plan_id, api_id, stage_names):
        """
        Associate an API with a usage plan for specific stages.
        """
        try:
            # Check if already associated
            response = self.api_client.get_usage_plan(usagePlanId=usage_plan_id)
            api_stages = response.get('apiStages', [])
            
            # Build list of stages already associated
            existing_stages = []
            for stage in api_stages:
                if stage.get('apiId') == api_id:
                    existing_stages.append(stage.get('stage'))
            
            # Find stages that need to be added
            stages_to_add = [s for s in stage_names if s not in existing_stages]
            
            if not stages_to_add:
                print(f"All stages already associated with usage plan")
                return
            
            # Add each missing stage
            for stage_name in stages_to_add:
                self.api_client.update_usage_plan(
                    usagePlanId=usage_plan_id,
                    patchOperations=[{
                        'op': 'add',
                        'path': '/apiStages',
                        'value': f'{api_id}:{stage_name}'
                    }]
                )
                print(f"Added API {api_id} stage '{stage_name}' to usage plan")
            
        except ClientError as e:
            print(f"Error associating API with usage plan: {e}")
    
    def associate_api_key_with_usage_plan(self, api_key_id, usage_plan_id):
        """Associate an API key with a usage plan."""
        try:
            # Check if already associated
            response = self.api_client.get_api_key(apiKey=api_key_id, includeValue=True)
            usage_plan_keys = response.get('usagePlanKeys', [])
            
            for key in usage_plan_keys:
                if key == usage_plan_id:
                    print(f"API key already associated with usage plan")
                    return
            
            # Create the association
            self.api_client.create_usage_plan_key(
                usagePlanId=usage_plan_id,
                keyId=api_key_id,
                keyType='API_KEY'
            )
            print(f"Associated API key with usage plan")
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'BadRequestException' and 'already exists' in str(e):
                print(f"API key already associated with usage plan")
            else:
                print(f"Error associating API key with usage plan: {e}")
    
    # ==================== API KEY AUTHENTICATION ====================
    
    def enable_api_key_authentication(self, api_id):
        """
        Enable API Key authentication on all methods for an API.
        This sets apiKeyRequired=True on all existing methods.
        """
        try:
            # Get all resources
            resources = self.api_client.get_resources(restApiId=api_id)
            methods_updated = 0
            
            for resource in resources.get('items', []):
                if 'resourceMethods' not in resource:
                    continue
                
                for method, method_info in resource['resourceMethods'].items():
                    # Check if apiKeyRequired is already set
                    current_required = method_info.get('apiKeyRequired', False)
                    if current_required:
                        print(f"API Key already required for {method} on {resource['path']}")
                        continue
                    
                    # Update method to require API key
                    try:
                        self.api_client.update_method(
                            restApiId=api_id,
                            resourceId=resource['id'],
                            httpMethod=method,
                            patchOperations=[{
                                'op': 'replace',
                                'path': '/apiKeyRequired',
                                'value': 'true'
                            }]
                        )
                        print(f"Enabled API Key for {method} on {resource['path']}")
                        methods_updated += 1
                    except ClientError as e:
                        if e.response['Error']['Code'] == 'NotFoundException':
                            print(f"Method {method} not found on {resource['path']}, skipping...")
                        else:
                            print(f"Error enabling API key for {method}: {e}")
            
            if methods_updated > 0:
                print(f"Updated {methods_updated} methods to require API key")
            else:
                print("No methods required updating (all already require API key)")
            
            return True
            
        except ClientError as e:
            print(f"Error getting resources: {e}")
            return False
    
    # ==================== API STAGE DEPLOYMENT ====================
    
    def deploy_api_stage(self, api_id, stage_name):
        """
        Deploy or re-deploy the API stage.
        This is CRITICAL for changes to take effect.
        """
        try:
            # Try to create deployment (first time)
            self.api_client.create_deployment(
                restApiId=api_id,
                stageName=stage_name,
                description='Security configuration deployment'
            )
            print(f"Deployed API to stage: {stage_name}")
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == 'ConflictException':
                # Stage already exists, update it
                try:
                    self.api_client.update_stage(
                        restApiId=api_id,
                        stageName=stage_name,
                        patchOperations=[
                            {'op': 'replace', 'path': '/description', 'value': 'Security configuration deployment'}
                        ]
                    )
                    print(f"Updated existing stage: {stage_name}")
                    return True
                except ClientError as update_error:
                    print(f"Error updating stage: {update_error}")
                    return False
            else:
                print(f"Error deploying API: {e}")
                return False
    
    # ==================== CLOUDWATCH LOGGING ====================
    
    def get_or_create_log_group(self, log_group_name):
        """Get or create CloudWatch log group for API Gateway."""
        try:
            # Check if log group exists
            response = self.cw_client.describe_log_groups(
                logGroupNamePrefix=log_group_name
            )
            for group in response.get('logGroups', []):
                if group['logGroupName'] == log_group_name:
                    print(f"Found existing log group: {log_group_name}")
                    return log_group_name
        except ClientError as e:
            print(f"Error checking log group: {e}")
        
        # Create log group
        try:
            print(f"Creating log group: {log_group_name}")
            self.cw_client.create_log_group(
                logGroupName=log_group_name
            )
            # Set retention policy
            self.cw_client.put_retention_policy(
                logGroupName=log_group_name,
                retentionInDays=DEFAULT_LOGGING_RETENTION_DAYS
            )
            print(f"Log group created: {log_group_name}")
            return log_group_name
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', '')
            if error_code == 'ResourceAlreadyExistsException':
                print(f"Log group already exists: {log_group_name}")
                return log_group_name
            else:
                print(f"Error creating log group: {e}")
                raise
    
    def get_or_create_iam_role(self, role_name):
        """Get or create IAM role for API Gateway to write CloudWatch logs."""
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
        
        # Check if role exists
        try:
            response = self.iam_client.get_role(RoleName=role_name)
            print(f"Found existing IAM role: {role_name}")
            return response['Role']['Arn']
        except ClientError as e:
            if e.response['Error']['Code'] != 'NoSuchEntity':
                print(f"Error checking IAM role: {e}")
        
        # Create IAM role
        try:
            print(f"Creating IAM role: {role_name}")
            response = self.iam_client.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=json.dumps(assume_role_policy),
                Description='Role for API Gateway CloudWatch logging'
            )
            role_arn = response['Role']['Arn']
            
            # Attach CloudWatch logs policy
            policy_name = f"{role_name}-policy"
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
                        "Resource": f"arn:aws:logs:{self.region}:{self.get_account_id()}:log-group:*"
                    }
                ]
            }
            
            self.iam_client.put_role_policy(
                RoleName=role_name,
                PolicyName=policy_name,
                PolicyDocument=json.dumps(policy_document)
            )
            
            print(f"IAM role created: {role_name}")
            return role_arn
            
        except ClientError as e:
            print(f"Error creating IAM role: {e}")
            raise
    
    def enable_cloudwatch_logging(self, api_id, stage_name, log_group_name=None, iam_role_name=None):
        """
        Enable CloudWatch logging for API Gateway stage.
        
        Args:
            api_id: The API ID
            stage_name: The stage name (e.g., 'prod', 'dev')
            log_group_name: Custom log group name (auto-generated if None)
            iam_role_name: Custom IAM role name (auto-generated if None)
        """
        if log_group_name is None:
            log_group_name = f"API-Gateway-Execution-Logs_{api_id}/{stage_name}"
        
        if iam_role_name is None:
            iam_role_name = f"APIGateway-CloudWatch-Logs-Role-{self.region}"
        
        # Get or create log group
        self.get_or_create_log_group(log_group_name)
        
        # Get or create IAM role
        role_arn = self.get_or_create_iam_role(iam_role_name)
        
        # Get current stage settings
        try:
            stage = self.api_client.get_stage(restApiId=api_id, stageName=stage_name)
            current_settings = stage.get('methodSettings', {})
            
            # Check if logging is already enabled
            logging_level = current_settings.get('loggingLevel')
            if logging_level == 'INFO':
                print(f"CloudWatch logging already enabled for stage {stage_name}")
                return True
                
        except ClientError as e:
            if e.response['Error']['Code'] != 'BadRequestException':
                print(f"Error getting stage: {e}")
        
        # Enable logging
        try:
            print(f"Enabling CloudWatch logging for stage {stage_name}")
            
            # Update stage settings for logging
            settings_to_update = [
                {
                    'op': 'replace',
                    'path': '/*/*/logging/loglevel',
                    'value': 'INFO'
                },
                {
                    'op': 'replace',
                    'path': '/*/*/logging/dataTrace',
                    'value': 'true'
                },
                {
                    'op': 'replace',
                    'path': '/*/*/logging/fullRequestBody',
                    'value': 'false'
                }
            ]
            
            self.api_client.update_stage(
                restApiId=api_id,
                stageName=stage_name,
                patchOperations=settings_to_update
            )
            
            # Set the CloudWatch role
            self.api_client.update_stage(
                restApiId=api_id,
                stageName=stage_name,
                patchOperations=[{
                    'op': 'replace',
                    'path': '/cloudwatchRoleArn',
                    'value': role_arn
                }]
            )
            
            # Also set the logging bucket via put_logging_config
            self.api_client.put_logging_config(
                restApiId=api_id,
                stageName=stage_name,
                loggingLevel='INFO',
                cloudwatchRoleArn=role_arn
            )
            
            print(f"CloudWatch logging enabled for stage {stage_name}")
            return True
            
        except ClientError as e:
            print(f"Error enabling CloudWatch logging: {e}")
            return False
    
    # ==================== MAIN SECURITY FUNCTION ====================
    
    def secure_api(self, api_key_name=None, usage_plan_name=None, stages=None, rate_limit=None, quota_limit=None,
                   description=None, enable_logging=True, cognito_user_pool_id=None, cognito_pool_name=None,
                   cognito_domain_prefix=None, authorizer_name=None, auth_endpoint_path=None, auth_method=None,
                   auth_all_methods=False, exclude_paths=None, create_app_client=False, callback_urls=None,
                   logout_urls=None):
        """
        Main function to secure an API Gateway API.
        
        Args:
            api_key_name: Name for the API key (default: DEFAULT_API_KEY_NAME)
            usage_plan_name: Name for the usage plan (default: DEFAULT_USAGE_PLAN_NAME)
            stages: List of stage names to secure (default: DEFAULT_STAGES split by comma)
            rate_limit: Requests per second (default: DEFAULT_RATE_LIMIT)
            quota_limit: Requests per month (default: DEFAULT_QUOTA_LIMIT)
            description: Description for the usage plan (default: DEFAULT_USAGE_PLAN_DESCRIPTION)
            enable_logging: Whether to enable CloudWatch logging
            cognito_user_pool_id: Existing Cognito User Pool ID (will verify existence)
            cognito_pool_name: Name for new User Pool (if creating new)
            cognito_domain_prefix: Domain prefix for hosted UI
            authorizer_name: Name for the Cognito authorizer
            auth_endpoint_path: Specific endpoint path to attach authorizer (e.g., '/api/v1/users')
            auth_method: HTTP method to attach authorizer (e.g., 'GET', 'POST')
            auth_all_methods: If True, attach authorizer to all methods
            exclude_paths: Paths to exclude when attaching authorizer to all methods
            create_app_client: Whether to create an App Client for the User Pool
            callback_urls: Callback URLs for the App Client
            logout_urls: Logout URLs for the App Client
            
        Returns:
            Dictionary with API key details, usage plan ID, Cognito info, and configuration summary
        """
        # Apply defaults if not provided
        if api_key_name is None:
            api_key_name = DEFAULT_API_KEY_NAME
        if usage_plan_name is None:
            usage_plan_name = DEFAULT_USAGE_PLAN_NAME
        if stages is None:
            stages = [s.strip() for s in DEFAULT_STAGES.split(',')]
        if rate_limit is None:
            rate_limit = DEFAULT_RATE_LIMIT
        if quota_limit is None:
            quota_limit = DEFAULT_QUOTA_LIMIT
        if description is None:
            description = DEFAULT_USAGE_PLAN_DESCRIPTION
        if exclude_paths is None:
            exclude_paths = []
        
        print(f"\n{'='*60}")
        print(f"Securing API Gateway API")
        print(f"{'='*60}")
        
        # Get API ID
        api_id = self.get_api_id()
        print(f"API ID: {api_id}")
        
        result = {
            'api_id': api_id,
            'api_name': self.api_name or api_id,
            'api_key_id': None,
            'usage_plan_id': None,
            'logging_enabled': False,
            'cognito_user_pool_id': None,
            'cognito_app_client_id': None,
            'authorizer_id': None
        }
        
        # Determine total steps based on configuration
        has_cognito = cognito_user_pool_id or cognito_pool_name or auth_all_methods or auth_endpoint_path
        total_steps = 7 if has_cognito else 6
        
        # Step 1: Get existing API key
        print(f"\n[1/{total_steps}] Managing API Key...")
        api_key_id = self.get_api_key_id(api_key_name)
        if not api_key_id:
            print(f"ERROR: API key '{api_key_name}' not found. Please create it first in AWS Console.")
            print(f"Go to: API Gateway > API Keys > Create API Key")
            return None
        result['api_key_id'] = api_key_id
        
        # Step 2: Create or get usage plan
        print(f"\n[2/{total_steps}] Managing Usage Plan...")
        usage_plan_id = self.get_or_create_usage_plan(
            usage_plan_name=usage_plan_name,
            description=description,
            rate_limit=rate_limit,
            quota_limit=quota_limit
        )
        result['usage_plan_id'] = usage_plan_id
        
        # Step 3: Associate API with usage plan
        print(f"\n[3/{total_steps}] Associating API with Usage Plan...")
        self.associate_api_with_usage_plan(usage_plan_id, api_id, stages)
        self.associate_api_key_with_usage_plan(api_key_id, usage_plan_id)
        
        # Step 4: Enable API key requirement on all methods
        print(f"\n[4/{total_steps}] Enabling API Key Authentication on Methods...")
        self.enable_api_key_authentication(api_id)
        
        # Step 5: Enable CloudWatch logging
        if enable_logging:
            print(f"\n[5/{total_steps}] Enabling CloudWatch Logging...")
            for stage in stages:
                log_group_name = f"API-Gateway-Execution-Logs_{api_id}/{stage}"
                logging_enabled = self.enable_cloudwatch_logging(
                    api_id=api_id,
                    stage_name=stage,
                    log_group_name=log_group_name
                )
                if logging_enabled:
                    result['logging_enabled'] = True
        
        # Step 6: Cognito Authentication (if configured)
        if has_cognito:
            print(f"\n[6/{total_steps}] Setting up Cognito Authentication...")
            
            # Get or create User Pool
            user_pool_id = self.get_or_create_user_pool(
                user_pool_id=cognito_user_pool_id,
                pool_name=cognito_pool_name,
                domain_prefix=cognito_domain_prefix
            )
            result['cognito_user_pool_id'] = user_pool_id
            
            # Create App Client if requested
            if create_app_client:
                app_client_id = self.create_app_client(
                    user_pool_id=user_pool_id,
                    callback_urls=callback_urls,
                    logout_urls=logout_urls
                )
                result['cognito_app_client_id'] = app_client_id
            
            # Create Cognito authorizer
            authorizer_id = self.create_cognito_authorizer(
                api_id=api_id,
                user_pool_id=user_pool_id,
                authorizer_name=authorizer_name
            )
            result['authorizer_id'] = authorizer_id
            
            # Attach authorizer to methods
            if auth_all_methods:
                self.attach_authorizer_to_all_methods(
                    api_id=api_id,
                    authorizer_id=authorizer_id,
                    exclude_paths=exclude_paths
                )
            elif auth_endpoint_path and auth_method:
                self.attach_authorizer_to_method(
                    api_id=api_id,
                    resource_path=auth_endpoint_path,
                    http_method=auth_method,
                    authorizer_id=authorizer_id
                )
        
        # Step 7 (or 6): Deploy API stage (CRITICAL for changes to take effect)
        print(f"\n[{total_steps}/{total_steps}] Deploying API Stage...")
        for stage in stages:
            self.deploy_api_stage(api_id, stage)
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"Security Configuration Complete!")
        print(f"{'='*60}")
        print(f"API Name: {result['api_name']}")
        print(f"API ID: {api_id}")
        print(f"API Key ID: {api_key_id}")
        print(f"Usage Plan ID: {usage_plan_id}")
        print(f"Rate Limit: {rate_limit} requests/second")
        print(f"Quota Limit: {quota_limit} requests/month")
        print(f"Logging Enabled: {result['logging_enabled']}")
        print(f"Stages: {', '.join(stages)}")
        
        if has_cognito:
            print(f"\n--- Cognito Authentication ---")
            print(f"User Pool ID: {result['cognito_user_pool_id']}")
            if result['cognito_app_client_id']:
                print(f"App Client ID: {result['cognito_app_client_id']}")
            print(f"Authorizer ID: {result['authorizer_id']}")
            if auth_endpoint_path and auth_method:
                print(f"Protected Endpoint: {auth_method} {auth_endpoint_path}")
            elif auth_all_methods:
                print(f"All methods protected (excluded: {exclude_paths})")
        
        print(f"{'='*60}\n")
        
        return result
    
def main():
    parser = argparse.ArgumentParser(
        description='Secure API Gateway with API Key, Usage Plan, CloudWatch Logging, and Cognito Authentication',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic security (API Key + Usage Plan + Logging)
  python securitise-api.py --api-name "my-api" --api-key-name "my-api-key" --usage-plan-name "my-plan"

  # Secure by API ID
  python securitise-api.py --api-id "abc123xyz" --api-key-name "prod-key" --stages prod

  # With custom rate/quota limits
  python securitise-api.py --api-name "my-api" --rate-limit 500 --quota-limit 50000

  # With Cognito authentication using existing User Pool
  python securitise-api.py --api-name "my-api" --cognito-user-pool-id "ap-southeast-2_XXXXX" \\
      --auth-endpoint-path "/api/v1/users" --auth-method "GET"

  # With Cognito authentication - create new User Pool and protect all methods
  python securitise-api.py --api-name "my-api" --cognito-pool-name "MyAPIPool" \\
      --auth-all-methods --exclude-paths "/health,/public"

  # Full setup with Cognito App Client
  python securitise-api.py --api-name "my-api" --cognito-user-pool-id "ap-southeast-2_XXXXX" \\
      --auth-endpoint-path "/api/v1/users" --auth-method "POST" \\
      --create-app-client --callback-urls "https://example.com/callback"
        """
    )
    
    # API identification
    parser.add_argument('--api-name', help='Name of the API Gateway API')
    parser.add_argument('--api-id', help='ID of the API Gateway API')
    
    # API Key and Usage Plan
    parser.add_argument('--api-key-name', default=DEFAULT_API_KEY_NAME, help='Name for the API key')
    parser.add_argument('--usage-plan-name', default=DEFAULT_USAGE_PLAN_NAME, help='Name for the usage plan')
    parser.add_argument('--rate-limit', type=int, default=DEFAULT_RATE_LIMIT, help='Rate limit (requests per second)')
    parser.add_argument('--quota-limit', type=int, default=DEFAULT_QUOTA_LIMIT, help='Quota limit (requests per month)')
    parser.add_argument('--stages', default=DEFAULT_STAGES, help='Comma-separated list of stages')
    parser.add_argument('--region', default=DEFAULT_REGION, help='AWS region')
    parser.add_argument('--description', default=DEFAULT_USAGE_PLAN_DESCRIPTION, help='Usage plan description')
    parser.add_argument('--disable-logging', action='store_true', help='Disable CloudWatch logging')
    
    # Cognito User Pool
    parser.add_argument('--cognito-user-pool-id', help='Existing Cognito User Pool ID (will verify existence)')
    parser.add_argument('--cognito-pool-name', default=DEFAULT_COGNITO_USER_POOL_NAME, 
                        help='Name for new Cognito User Pool (if creating new)')
    parser.add_argument('--cognito-domain-prefix', default=DEFAULT_COGNITO_DOMAIN_PREFIX,
                        help='Domain prefix for Cognito hosted UI (must be globally unique)')
    
    # Cognito Authorizer
    parser.add_argument('--authorizer-name', default=DEFAULT_AUTHORIZER_NAME,
                        help='Name for the Cognito authorizer')
    parser.add_argument('--auth-endpoint-path', 
                        help='Specific endpoint path to attach authorizer (e.g., "/api/v1/users")')
    parser.add_argument('--auth-method', 
                        help='HTTP method to attach authorizer (e.g., "GET", "POST")')
    parser.add_argument('--auth-all-methods', action='store_true',
                        help='Attach authorizer to all methods in the API')
    parser.add_argument('--exclude-paths', 
                        help='Comma-separated list of paths to exclude from authorizer (e.g., "/health,/public")')
    
    # Cognito App Client
    parser.add_argument('--create-app-client', action='store_true',
                        help='Create an App Client for the User Pool')
    parser.add_argument('--callback-urls', 
                        help='Comma-separated list of callback URLs for OAuth')
    parser.add_argument('--logout-urls', 
                        help='Comma-separated list of logout URLs for OAuth')
    
    args = parser.parse_args()
    
    if not args.api_name and not args.api_id:
        parser.error("Either --api-name or --api-id must be provided")
    
    # Validate Cognito arguments
    if args.auth_method and not args.auth_endpoint_path:
        parser.error("--auth-method requires --auth-endpoint-path")
    if args.auth_endpoint_path and not args.auth_method and not args.auth_all_methods:
        parser.error("--auth-endpoint-path requires --auth-method or use --auth-all-methods instead")
    
    stages = [s.strip() for s in args.stages.split(',')]
    
    # Parse exclude paths
    exclude_paths = []
    if args.exclude_paths:
        exclude_paths = [p.strip() for p in args.exclude_paths.split(',')]
    
    # Parse callback and logout URLs
    callback_urls = None
    if args.callback_urls:
        callback_urls = [u.strip() for u in args.callback_urls.split(',')]
    
    logout_urls = None
    if args.logout_urls:
        logout_urls = [u.strip() for u in args.logout_urls.split(',')]
    
    securitizer = APIGatewaySecuritizer(
        api_name=args.api_name,
        api_id=args.api_id,
        region=args.region
    )
    
    try:
        result = securitizer.secure_api(
            api_key_name=args.api_key_name,
            usage_plan_name=args.usage_plan_name,
            stages=stages,
            rate_limit=args.rate_limit,
            quota_limit=args.quota_limit,
            description=args.description,
            enable_logging=not args.disable_logging,
            cognito_user_pool_id=args.cognito_user_pool_id,
            cognito_pool_name=args.cognito_pool_name,
            cognito_domain_prefix=args.cognito_domain_prefix,
            authorizer_name=args.authorizer_name,
            auth_endpoint_path=args.auth_endpoint_path,
            auth_method=args.auth_method,
            auth_all_methods=args.auth_all_methods,
            exclude_paths=exclude_paths,
            create_app_client=args.create_app_client,
            callback_urls=callback_urls,
            logout_urls=logout_urls
        )
        print("\nSecurity configuration completed successfully!")
        return result
    except Exception as e:
        print(f"\nError: {e}")
        raise


if __name__ == '__main__':
    main()
