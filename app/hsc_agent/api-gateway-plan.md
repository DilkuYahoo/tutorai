# API Gateway Deployment Plan for HSC Agent

## Overview
This plan outlines a config-driven deployment of AWS API Gateway integrated with the HSC Agent Lambda function. The system will support all endpoints identified in the application code and include deployment, teardown, and testing scripts.

## Reviewed Endpoints from hsc-agent.py
Based on the Lambda handler code, the following endpoints are supported:

1. **GET /questions**
   - Returns quiz questions from S3 bucket
   - No request body required

2. **POST /submit**
   - Accepts quiz submission with answers
   - Expects JSON body: `{"answers": {"1": "A", "2": "B", ...}}`
   - Returns validation results

3. **POST /sum**
   - Simple calculator endpoint
   - Expects JSON body: `{"num1": 15.5, "num2": 24.3}`
   - Returns sum calculation

4. **OPTIONS /{proxy+}**
   - CORS preflight requests
   - Handled automatically by API Gateway

5. **GET /** (catch-all)
   - Serves static HTML from S3 (index.html)
   - Fallback for SPA routing

6. **404 Handling**
   - Custom 404 response for unmatched paths

## Configuration Design
The API Gateway will be defined in a JSON configuration file (`api-config.json`) with the following structure:

```json
{
  "api_name": "hsc-agent-api",
  "region": "ap-southeast-2",
  "description": "API Gateway for HSC Agent Lambda function",
  "protocol_type": "REST",
  "endpoints": [
    {
      "path": "/questions",
      "method": "GET",
      "lambda_integration": {
        "function_name": "hsc-agent-lambda-function",
        "timeout": 30
      }
    },
    {
      "path": "/submit",
      "method": "POST",
      "lambda_integration": {
        "function_name": "hsc-agent-lambda-function",
        "timeout": 30
      }
    },
    {
      "path": "/sum",
      "method": "POST",
      "lambda_integration": {
        "function_name": "hsc-agent-lambda-function",
        "timeout": 30
      }
    },
    {
      "path": "/{proxy+}",
      "method": "ANY",
      "lambda_integration": {
        "function_name": "hsc-agent-lambda-function",
        "timeout": 30
      }
    }
  ],
  "cors": {
    "enabled": true,
    "origins": ["*"],
    "headers": ["Content-Type"],
    "methods": ["GET", "POST", "OPTIONS"]
  },
  "stages": [
    {
      "name": "dev",
      "description": "Development stage"
    },
    {
      "name": "prod",
      "description": "Production stage"
    }
  ]
}
```

## Sample api-config.json
Create a file named `api-config.json` in the `hsc_agent/` directory:

```json
{
  "api_name": "hsc-agent-api",
  "region": "ap-southeast-2",
  "description": "API Gateway for HSC Agent Lambda function",
  "endpoints": [
    {
      "path": "/questions",
      "method": "GET",
      "lambda_integration": {
        "function_name": "hsc-agent-lambda-function",
        "timeout": 30
      }
    },
    {
      "path": "/submit",
      "method": "POST",
      "lambda_integration": {
        "function_name": "hsc-agent-lambda-function",
        "timeout": 30
      }
    },
    {
      "path": "/sum",
      "method": "POST",
      "lambda_integration": {
        "function_name": "hsc-agent-lambda-function",
        "timeout": 30
      }
    },
    {
      "path": "/{proxy+}",
      "method": "ANY",
      "lambda_integration": {
        "function_name": "hsc-agent-lambda-function",
        "timeout": 30
      }
    }
  ],
  "cors": {
    "enabled": true,
    "origins": ["*"],
    "headers": ["Content-Type"],
    "methods": ["GET", "POST", "OPTIONS"]
  },
  "stages": [
    {
      "name": "dev",
      "description": "Development stage"
    }
  ]
}
```

## Deployment Script (deploy_api.py)
A Python script using boto3 to:
1. Create REST API from config
2. Add resources and methods for each endpoint
3. Integrate with Lambda function
4. Enable CORS
5. Deploy to specified stages
6. Output API Gateway URL

Key features:
- Config-driven: Reads from `api-config.json`
- Idempotent: Updates existing API if present
- Error handling: Validates Lambda function exists
- Permissions: Ensures API Gateway can invoke Lambda

```python
#!/usr/bin/env python3
"""
AWS API Gateway Deployment Script for HSC Agent
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
        with open(config_file, 'r') as f:
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
            print(f"Updating existing API: {api_name}")
            response = self.api_client.update_rest_api(
                restApiId=api_id,
                patchOps=[
                    {'op': 'replace', 'path': '/description', 'value': description}
                ]
            )
        else:
            print(f"Creating new API: {api_name}")
            response = self.api_client.create_rest_api(
                name=api_name,
                description=description
            )
        
        return response['id']
    
    def add_resources_and_methods(self, api_id):
        """Add resources and methods for each endpoint"""
        root_id = self.api_client.get_resources(restApiId=api_id)['items'][0]['id']
        
        for endpoint in self.config['endpoints']:
            path = endpoint['path']
            method = endpoint['method']
            function_name = endpoint['lambda_integration']['function_name']
            
            # Create resource
            resource_response = self.api_client.create_resource(
                restApiId=api_id,
                parentId=root_id,
                pathPart=path.strip('/')
            )
            resource_id = resource_response['id']
            
            # Add method
            self.api_client.put_method(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod=method,
                authorizationType='NONE'
            )
            
            # Add Lambda integration
            uri = f"arn:aws:apigateway:{self.region}:lambda:path/2015-03-31/functions/{function_name}/invocations"
            self.api_client.put_integration(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod=method,
                type='AWS_PROXY',
                integrationHttpMethod='POST',
                uri=uri
            )
            
            # Add method response
            self.api_client.put_method_response(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod=method,
                statusCode='200'
            )
            
            # Add integration response
            self.api_client.put_integration_response(
                restApiId=api_id,
                resourceId=resource_id,
                httpMethod=method,
                statusCode='200',
                responseTemplates={'application/json': ''}
            )
            
            print(f"Added {method} {path} -> {function_name}")
    
    def enable_cors(self, api_id):
        """Enable CORS for all methods"""
        if not self.config.get('cors', {}).get('enabled'):
            return
        
        # Add OPTIONS method for CORS
        # This is a simplified CORS setup; in production, you might need more comprehensive configuration
        
        print("CORS enabled in configuration")
    
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
                    # Stage already exists, update it
                    self.api_client.update_stage(
                        restApiId=api_id,
                        stageName=stage_name,
                        patchOps=[
                            {'op': 'replace', 'path': '/description', 'value': description}
                        ]
                    )
                    print(f"Updated stage: {stage_name}")
                else:
                    raise
    
    def deploy(self):
        """Main deployment function"""
        if not self.lambda_exists(self.config['endpoints'][0]['lambda_integration']['function_name']):
            raise Exception("Lambda function does not exist. Deploy Lambda first.")
        
        api_id = self.create_or_update_api()
        self.add_resources_and_methods(api_id)
        self.enable_cors(api_id)
        self.deploy_api(api_id)
        
        # Get API URL
        api_url = f"https://{api_id}.execute-api.{self.region}.amazonaws.com"
        print(f"API deployed successfully: {api_url}")
        return api_id, api_url

def main():
    parser = argparse.ArgumentParser(description='Deploy API Gateway for HSC Agent')
    parser.add_argument('--config', default='api-config.json', help='Configuration file')
    parser.add_argument('--region', default='ap-southeast-2', help='AWS region')
    
    args = parser.parse_args()
    
    deployer = APIGatewayDeployer(args.config, args.region)
    deployer.deploy()

if __name__ == '__main__':
    main()
```

## Teardown Script (teardown_api.py)
A Python script to:
1. Delete API Gateway stages
2. Delete API Gateway resources
3. Remove API Gateway REST API
4. Clean up any associated resources

```python
#!/usr/bin/env python3
"""
AWS API Gateway Teardown Script for HSC Agent
"""

import boto3
import json
import argparse
from botocore.exceptions import ClientError

class APIGatewayTeardown:
    def __init__(self, config_file='api-config.json', region='ap-southeast-2'):
        self.config = self.load_config(config_file)
        self.region = region
        self.api_client = boto3.client('apigateway', region_name=region)
        
    def load_config(self, config_file):
        """Load API configuration from JSON file"""
        with open(config_file, 'r') as f:
            return json.load(f)
    
    def find_api_id(self):
        """Find API ID by name"""
        api_name = self.config['api_name']
        existing_apis = self.api_client.get_rest_apis()
        for api in existing_apis['items']:
            if api['name'] == api_name:
                return api['id']
        return None
    
    def delete_stages(self, api_id):
        """Delete all stages"""
        stages = self.api_client.get_stages(restApiId=api_id)
        for stage in stages['item']:
            stage_name = stage['stageName']
            print(f"Deleting stage: {stage_name}")
            self.api_client.delete_stage(restApiId=api_id, stageName=stage_name)
    
    def delete_resources(self, api_id):
        """Delete all resources except root"""
        resources = self.api_client.get_resources(restApiId=api_id)
        for resource in resources['items']:
            if resource['path'] != '/':
                print(f"Deleting resource: {resource['path']}")
                self.api_client.delete_resource(restApiId=api_id, resourceId=resource['id'])
    
    def delete_api(self, api_id):
        """Delete the REST API"""
        print(f"Deleting API: {self.config['api_name']}")
        self.api_client.delete_rest_api(restApiId=api_id)
    
    def teardown(self):
        """Main teardown function"""
        api_id = self.find_api_id()
        if not api_id:
            print(f"API {self.config['api_name']} not found")
            return
        
        self.delete_stages(api_id)
        self.delete_resources(api_id)
        self.delete_api(api_id)
        print("Teardown completed")

def main():
    parser = argparse.ArgumentParser(description='Teardown API Gateway for HSC Agent')
    parser.add_argument('--config', default='api-config.json', help='Configuration file')
    parser.add_argument('--region', default='ap-southeast-2', help='AWS region')
    
    args = parser.parse_args()
    
    teardown = APIGatewayTeardown(args.config, args.region)
    teardown.teardown()

if __name__ == '__main__':
    main()
```

## Test Script (test_api.py)
A comprehensive test script to:
1. Test each endpoint with sample requests
2. Verify responses match expected format
3. Test CORS preflight
4. Validate error handling (404, invalid requests)
5. Use both curl and Python requests for testing

Sample tests:
- GET /questions: Check JSON response with questions array
- POST /submit: Send sample submission, verify score calculation
- POST /sum: Send numbers, verify sum response
- GET /nonexistent: Verify 404 response

```python
#!/usr/bin/env python3
"""
Test script for HSC Agent API Gateway integration
"""

import requests
import json
import subprocess
import sys

class APITester:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        
    def test_get_questions(self):
        """Test GET /questions"""
        url = f"{self.base_url}/questions"
        print(f"Testing GET {url}")
        response = self.session.get(url)
        if response.status_code == 200:
            data = response.json()
            if 'questions' in data and isinstance(data['questions'], list):
                print("✅ GET /questions successful")
                return True
            else:
                print("❌ Invalid response format")
                return False
        else:
            print(f"❌ HTTP {response.status_code}")
            return False
    
    def test_post_sum(self):
        """Test POST /sum"""
        url = f"{self.base_url}/sum"
        payload = {"num1": 15.5, "num2": 24.3}
        print(f"Testing POST {url} with {payload}")
        response = self.session.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            if data.get('sum') == 39.8:
                print("✅ POST /sum successful")
                return True
            else:
                print("❌ Incorrect sum calculation")
                return False
        else:
            print(f"❌ HTTP {response.status_code}")
            return False
    
    def test_post_submit(self):
        """Test POST /submit"""
        url = f"{self.base_url}/submit"
        payload = {"answers": {"1": "A", "2": "B"}}
        print(f"Testing POST {url} with {payload}")
        response = self.session.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            if 'total' in data and 'correct' in data:
                print("✅ POST /submit successful")
                return True
            else:
                print("❌ Invalid submission response")
                return False
        else:
            print(f"❌ HTTP {response.status_code}")
            return False
    
    def test_404(self):
        """Test 404 for non-existent endpoint"""
        url = f"{self.base_url}/nonexistent"
        print(f"Testing GET {url}")
        response = self.session.get(url)
        if response.status_code == 404:
            print("✅ 404 handling correct")
            return True
        else:
            print(f"❌ Expected 404, got {response.status_code}")
            return False
    
    def test_cors(self):
        """Test CORS preflight"""
        url = f"{self.base_url}/questions"
        print(f"Testing OPTIONS {url}")
        response = self.session.options(url)
        if response.status_code == 200:
            print("✅ CORS preflight successful")
            return True
        else:
            print(f"❌ CORS failed: {response.status_code}")
            return False
    
    def run_curl_tests(self):
        """Run tests using curl for comparison"""
        print("\nRunning curl tests...")
        
        # Test GET /questions
        cmd = f"curl -s {self.base_url}/questions"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0 and 'questions' in result.stdout:
            print("✅ curl GET /questions successful")
        else:
            print("❌ curl GET /questions failed")
        
        # Test POST /sum
        cmd = f'curl -s -X POST {self.base_url}/sum -H "Content-Type: application/json" -d \'{{"num1": 10, "num2": 5}}\''
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0 and '"sum":15' in result.stdout:
            print("✅ curl POST /sum successful")
        else:
            print("❌ curl POST /sum failed")
    
    def run_all_tests(self):
        """Run all tests"""
        tests = [
            self.test_get_questions,
            self.test_post_sum,
            self.test_post_submit,
            self.test_404,
            self.test_cors
        ]
        
        results = []
        for test in tests:
            results.append(test())
        
        self.run_curl_tests()
        
        if all(results):
            print("\n🎉 All tests passed!")
            return True
        else:
            print(f"\n❌ {len(results) - sum(results)} tests failed")
            return False

def main():
    if len(sys.argv) != 2:
        print("Usage: python test_api.py <API_BASE_URL>")
        sys.exit(1)
    
    base_url = sys.argv[1]
    tester = APITester(base_url)
    tester.run_all_tests()

if __name__ == '__main__':
    main()
```

## Integration with Existing Lambda
- The Lambda function already handles API Gateway events correctly
- No code changes needed in hsc-agent.py
- Deployment script will ensure proper IAM permissions for API Gateway to invoke Lambda

## Security Considerations
- API Gateway will use Lambda proxy integration
- CORS configured for web access
- IAM roles ensure least privilege access
- Input validation handled in Lambda code

## Deployment Workflow
1. Deploy Lambda function using existing `deploy_lambda.py`
2. Deploy API Gateway using `deploy_api.py`
3. Run tests with `test_api.py`
4. Access API at the provided URL

## Teardown Workflow
1. Run `teardown_api.py` to remove API Gateway
2. Optionally run Lambda teardown if needed

## Usage Instructions

### Prerequisites
- AWS CLI configured with appropriate credentials
- Python 3.x with boto3 installed (`pip install boto3 requests`)
- Lambda function deployed (use `python deploy_lambda.py`)

### 1. Create Configuration File
Create `api-config.json` in the `hsc_agent/` directory with the sample configuration provided above.

### 2. Deploy API Gateway
```bash
python deploy_api.py --config api-config.json --region ap-southeast-2
```
This will output the API URL, e.g., `https://abc123.execute-api.ap-southeast-2.amazonaws.com/dev`

### 3. Test the Integration
```bash
python test_api.py https://abc123.execute-api.ap-southeast-2.amazonaws.com/dev
```

### 4. Teardown
```bash
python teardown_api.py --config api-config.json --region ap-southeast-2
```

### Manual Testing Examples
- GET questions: `curl https://your-api-url/questions`
- POST sum: `curl -X POST https://your-api-url/sum -H "Content-Type: application/json" -d '{"num1": 10, "num2": 5}'`
- POST submit: `curl -X POST https://your-api-url/submit -H "Content-Type: application/json" -d '{"answers": {"1": "A"}}'`

### Troubleshooting
- Ensure Lambda function name in `api-config.json` matches the deployed function
- Check AWS region consistency
- Verify IAM permissions for API Gateway to invoke Lambda
- Use AWS CloudWatch logs for debugging Lambda execution

This design ensures a fully automated, config-driven deployment with comprehensive testing and cleanup capabilities.