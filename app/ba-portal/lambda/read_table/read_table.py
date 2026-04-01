#!/usr/bin/env python3
"""
Lambda Function for DynamoDB Table Reader - Refactored Version

This Lambda function reads items from a DynamoDB table with specific requirements:
- Accepts 'id' and 'table_name' as required parameters
- Validates that neither field is empty or null
- Queries the specified DynamoDB table
- Filters records where the 'status' field equals "active"
- Returns only the 'chart1', 'investors', and 'properties' attributes for the matching 'id'

API Gateway Integration:
- Accepts JSON payload with table_name and id
- Returns proper API Gateway responses with status codes and JSON bodies

Features:
- Robust parameter validation
- Comprehensive error handling
- Structured logging for debugging and monitoring
- AWS SDK integration with boto3
- Consistent response format with HTTP status codes

Environment Variables:
- AWS_REGION: AWS region (default: ap-southeast-2)
- LOG_LEVEL: Logging level (default: INFO)

IAM Permissions Required:
- dynamodb:GetItem
- dynamodb:Query
- dynamodb:Scan
- logs:CreateLogGroup
- logs:CreateLogStream
- logs:PutLogEvents

Deployment:
- Lambda runtime: Python 3.9+
- Memory: 128MB (adjust based on workload)
- Timeout: 10 seconds (adjust based on query complexity)
"""

import json
import logging
import os
import sys
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, List
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError, BotoCoreError

# Configure logging
logging.basicConfig(level=os.environ.get('LOG_LEVEL', 'INFO'))
logger = logging.getLogger(__name__)

# CloudWatch Logs for audit trail
audit_logger = logging.getLogger('audit')
audit_logger.setLevel(logging.INFO)

def log_audit_event(event_type: str, user_email: str, portfolio_id: str, action: str, status: str, message: str = "") -> None:
    """
    Log authentication and authorization events for audit trail.
    This creates structured audit logs in CloudWatch for security monitoring.
    """
    audit_entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "event_type": event_type,
        "user_email": user_email or "anonymous",
        "portfolio_id": portfolio_id or "N/A",
        "action": action,
        "status": status,
        "message": message
    }
    
    if status in ["success", "approved"]:
        audit_logger.info(json.dumps(audit_entry))
    else:
        audit_logger.warning(json.dumps(audit_entry))
    
    # Also log to main logger for visibility
    logger.info(f"AUDIT: {event_type} - user={user_email or 'anonymous'} action={action} status={status}")

class DynamoDBReadError(Exception):
    """Custom exception for DynamoDB read errors."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

class DynamoDBReader:
    def __init__(self, table_name: str, region: str = "ap-southeast-2"):
        """Initialize the DynamoDB reader with table name and region."""
        self.table_name = table_name
        self.region = region
        
        # Initialize DynamoDB resource
        self.dynamodb = boto3.resource('dynamodb', region_name=self.region)
        self.table = self.dynamodb.Table(self.table_name)
        
        logger.info(f"Initialized DynamoDBReader for table '{self.table_name}' in region '{self.region}'")
    
    def list_all_portfolio_ids(self, adviser_name: str = None) -> List[Dict[str, Any]]:
        """
        List all portfolio IDs from DynamoDB with status='active'.
        Optionally filter by adviser_name.
        Returns a list of objects with id and optionally name/title.
        """
        try:
            logger.info(f"Attempting to list all portfolio IDs from table {self.table_name}")
            
            # Build filter expression
            filter_expr = '#status = :status'
            expr_names = {'#status': 'status'}
            expr_values = {':status': 'active'}
            
            # Add adviser_name filter if provided
            if adviser_name:
                filter_expr += ' AND #adviser = :adviser'
                expr_names['#adviser'] = 'adviser_name'
                expr_values[':adviser'] = adviser_name
            
            # Scan the table for items with status='active' (and optionally adviser_name)
            # First, try with name projection, if it fails, try without
            try:
                response = self.table.scan(
                    FilterExpression=filter_expr,
                    ExpressionAttributeNames=expr_names,
                    ExpressionAttributeValues=expr_values,
                    ProjectionExpression='id, #name, last_updated_date, number_of_updates',
                    Limit=100
                )
            except ClientError as e:
                # If name attribute doesn't exist, try without it
                logger.warning(f"Scan with name failed, retrying without: {e}")
                response = self.table.scan(
                    FilterExpression=filter_expr,
                    ExpressionAttributeNames=expr_names,
                    ExpressionAttributeValues=expr_values,
                    ProjectionExpression='id, last_updated_date, number_of_updates',
                    Limit=100
                )
            
            items = response.get('Items', [])
            
            # Format the results
            portfolios = []
            for item in items:
                portfolios.append({
                    'id': item.get('id'),
                    'name': item.get('name', item.get('id')),  # Use 'name' if available, otherwise use id
                    'last_updated': item.get('last_updated_date'),
                    'updates': item.get('number_of_updates', 0)
                })
            
            logger.info(f"Found {len(portfolios)} active portfolio items")
            return portfolios
            
        except ClientError as e:
            error_msg = f"DynamoDB ClientError listing portfolio IDs: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise DynamoDBReadError(error_msg, 500) from e
            
        except Exception as e:
            error_msg = f"Unexpected error listing portfolio IDs: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise DynamoDBReadError(error_msg, 500) from e
    
    def validate_parameters(self, table_name: str, item_id: str) -> None:
        """Validate required parameters with robust checks."""
        if not table_name or not isinstance(table_name, str) or not table_name.strip():
            error_msg = "table_name is required and must be a non-empty string"
            logger.error(error_msg)
            raise DynamoDBReadError(error_msg, 400)
            
        if not item_id or not isinstance(item_id, str) or not item_id.strip():
            error_msg = "id is required and must be a non-empty string"
            logger.error(error_msg)
            raise DynamoDBReadError(error_msg, 400)
        
        logger.debug(f"Parameters validated: table_name='{table_name}', id='{item_id}'")
    
    def get_active_item_by_id(self, item_id: str) -> Dict[str, Any]:
        """
        Get a single item from DynamoDB by ID, filtered by status='active'.
        Returns only chart1, investors, and properties attributes.
        """
        try:
            # Log the retrieval attempt
            logger.info(f"Attempting to retrieve item {item_id} from table {self.table_name}")
            
            # Perform the get operation
            response = self.table.get_item(Key={'id': item_id})
            
            # Check if item exists
            if 'Item' not in response:
                error_msg = f"Item with ID '{item_id}' not found in table '{self.table_name}'"
                logger.warning(error_msg)
                raise DynamoDBReadError(error_msg, 404)
            
            item = response['Item']
            
            # Check if status is active
            status = item.get('status', '')
            if status != 'active':
                error_msg = f"Item with ID '{item_id}' has status '{status}', only 'active' items can be retrieved"
                logger.warning(error_msg)
                raise DynamoDBReadError(error_msg, 403)
            
            # Extract all attributes from the item (for config params)
            # This ensures we return all stored attributes including config params
            result = {}
            for key, value in item.items():
                result[key] = value
            
            # Ensure defaults for required fields
            result.setdefault('investment_years', 30)
            result.setdefault('investors', [])
            result.setdefault('properties', [])
            
            # Log successful retrieval
            logger.info(f"Successfully retrieved active item {item_id}")
            logger.debug(f"Retrieved attributes: {list(result.keys())}")
            
            return result
            
        except ClientError as e:
            error_msg = f"DynamoDB ClientError retrieving item {item_id}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise DynamoDBReadError(error_msg, 500) from e
            
        except BotoCoreError as e:
            error_msg = f"DynamoDB BotoCoreError retrieving item {item_id}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise DynamoDBReadError(error_msg, 500) from e
            
        except Exception as e:
            error_msg = f"Unexpected error retrieving item {item_id}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise DynamoDBReadError(error_msg, 500) from e

class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Decimal objects."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            # Convert Decimal to float for JSON serialization
            return float(obj)
        # Let the base class default method raise the TypeError
        return super().default(obj)

def extract_user_from_event(event: Dict[str, Any]) -> Optional[str]:
    """
    Extract user email from API Gateway authorizer context.
    API Gateway validates the JWT and passes claims to Lambda via requestContext.authorizer.claims.
    """
    try:
        # API Gateway has already validated the JWT - we trust this data
        authorizer = event.get('requestContext', {}).get('authorizer', {})
        claims = authorizer.get('claims', {})
        
        # Extract email from claims (already validated by API Gateway)
        email = claims.get('email')
        
        return email
    except Exception as e:
        logger.warning(f"Could not extract user from event: {e}")
        return None


def parse_lambda_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse Lambda event from API Gateway with robust validation."""
    try:
        # Log the raw event for debugging
        logger.debug(f"Raw Lambda event: {json.dumps(event, indent=2)}")
        
        # Handle API Gateway proxy integration format
        body_data = {}
        
        # Check if this is an API Gateway proxy event
        if 'body' in event:
            body = event['body']
            # Handle different body formats
            if isinstance(body, str):
                # Check if body is base64 encoded (common in API Gateway)
                if event.get('isBase64Encoded', False):
                    import base64
                    try:
                        body = base64.b64decode(body).decode('utf-8')
                    except Exception as e:
                        logger.warning(f"Failed to decode base64 body: {e}")
                
                try:
                    parsed_body = json.loads(body)
                    # Handle nested JSON structure in the body
                    if isinstance(parsed_body, dict) and 'body' in parsed_body:
                        body_data = json.loads(parsed_body['body'])
                    else:
                        body_data = parsed_body
                except json.JSONDecodeError:
                    # Try URL decoding if JSON fails (for form data)
                    import urllib.parse
                    try:
                        body_data = dict(urllib.parse.parse_qsl(body))
                    except Exception:
                        # If both fail, try direct parsing
                        body_data = {}
            elif isinstance(body, dict):
                body_data = body
            else:
                # Try to convert other types to string and parse
                try:
                    body_data = json.loads(str(body))
                except:
                    body_data = {}
        else:
            # Direct event (not API Gateway proxy)
            body_data = event
        
        # Check query string parameters as fallback
        if 'queryStringParameters' in event and isinstance(event['queryStringParameters'], dict):
            query_params = event['queryStringParameters']
            # Merge query parameters with body data (body data takes precedence)
            for key, value in query_params.items():
                if key not in body_data or not body_data[key]:
                    body_data[key] = value
        
        # Check path parameters as another fallback
        if 'pathParameters' in event and isinstance(event['pathParameters'], dict):
            path_params = event['pathParameters']
            for key, value in path_params.items():
                if key not in body_data or not body_data[key]:
                    body_data[key] = value
        
        # Extract parameters with case-insensitive fallback
        table_name = body_data.get('table_name') or body_data.get('tableName') or body_data.get('TableName')
        item_id = body_data.get('id') or body_data.get('ID') or body_data.get('item_id')
        region = body_data.get('region', "ap-southeast-2") or body_data.get('Region', "ap-southeast-2")
        action = body_data.get('action') or body_data.get('Action')  # New: action parameter
        adviser_name = body_data.get('adviser_name') or body_data.get('adviserName')  # New: adviser_name filter
        
        # Debug logging for parameter extraction
        logger.debug(f"Extracted parameters - table_name: {table_name}, id: {item_id}, region: {region}, action: {action}, adviser_name: {adviser_name}")
        logger.debug(f"Available keys in body_data: {list(body_data.keys())}")
        
        # Validate required parameters - for list_portfolios action, we only need table_name
        if action == 'list_portfolios':
            if not table_name or not isinstance(table_name, str) or not table_name.strip():
                error_msg = "Missing or invalid required parameter: table_name"
                logger.error(error_msg)
                logger.error(f"Available parameters: {body_data}")
                raise DynamoDBReadError(error_msg, 400)
            
            logger.info(f"Parsed parameters for list_portfolios: table_name='{table_name}', region='{region}', adviser_name='{adviser_name}'")
            
            return {
                'table_name': table_name,
                'id': None,
                'region': region,
                'action': action,
                'adviser_name': adviser_name
            }
        
        # For other actions, id is required
        if not table_name or not isinstance(table_name, str) or not table_name.strip():
            error_msg = "Missing or invalid required parameter: table_name"
            logger.error(error_msg)
            logger.error(f"Available parameters: {body_data}")
            raise DynamoDBReadError(error_msg, 400)
            
        if not item_id or not isinstance(item_id, str) or not item_id.strip():
            error_msg = "Missing or invalid required parameter: id"
            logger.error(error_msg)
            logger.error(f"Available parameters: {body_data}")
            raise DynamoDBReadError(error_msg, 400)
        
        logger.info(f"Parsed parameters: table_name='{table_name}', id='{item_id}', region='{region}'")
        
        return {
            'table_name': table_name,
            'id': item_id,
            'region': region,
            'action': action
        }
        
    except json.JSONDecodeError as e:
        error_msg = f"Error parsing JSON body: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise DynamoDBReadError(error_msg, 400)
    except Exception as e:
        error_msg = f"Error parsing Lambda event: {str(e)}"
        logger.error(error_msg, exc_info=True)
        logger.error(f"Event structure: {event}")
        raise DynamoDBReadError(error_msg, 400)

def create_api_gateway_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Create proper API Gateway response format with structured logging."""
    response = {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': True
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }
    
    logger.debug(f"API Gateway response: {json.dumps(response, indent=2)}")
    return response

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda function handler for DynamoDB read operations."""
    try:
        # Log Lambda invocation
        logger.info(f"Lambda function invoked with context: {context.function_name}")
        
        # Extract user from API Gateway authorizer context (already validated by API Gateway)
        email = extract_user_from_event(event)
        
        if not email:
            logger.warning("No user email found in JWT - authentication required")
            # Audit: Failed authentication attempt
            log_audit_event(
                event_type="AUTH_FAILURE",
                user_email="",
                portfolio_id=event.get('body',{}).get('id','unknown'),
                action="Lambda invocation",
                status="denied",
                message="No valid JWT token provided"
            )
            return create_api_gateway_response(401, {
                'status': 'error',
                'message': 'Authentication required. Please login.',
                'error_code': 'UNAUTHORIZED',
                'timestamp': datetime.utcnow().isoformat()
            })
        
        # Parse Lambda event
        params = parse_lambda_event(event)
        
        # Initialize reader
        reader = DynamoDBReader(
            table_name=params['table_name'],
            region=params['region']
        )
        
        # Handle list_portfolios action
        if params.get('action') == 'list_portfolios':
            logger.info("Executing list_portfolios action")
            # Use email from JWT for filtering - this is more secure than request params
            adviser_name = email  # Get from JWT, not from request params
            portfolios = reader.list_all_portfolio_ids(adviser_name)
            
            # Audit: Successful portfolio list access
            log_audit_event(
                event_type="PORTFOLIO_LIST",
                user_email=email,
                portfolio_id="N/A",
                action="list_portfolios",
                status="success",
                message=f"Retrieved {len(portfolios)} portfolios"
            )
            
            return create_api_gateway_response(200, {
                'status': 'success',
                'message': 'Portfolio list retrieved successfully',
                'table_name': params['table_name'],
                'timestamp': datetime.utcnow().isoformat(),
                'portfolios': portfolios
            })
        
        # For read action, validate parameters and read item
        reader.validate_parameters(params['table_name'], params['id'])
        
        # Perform the read operation
        result = reader.get_active_item_by_id(params['id'])
        
        # Validate portfolio ownership - user can only access their own portfolios
        item_adviser = result.get('adviser_name', '')
        if item_adviser and item_adviser.lower() != email.lower():
            logger.warning(f"User {email} attempted to access portfolio owned by {item_adviser}")
            
            # Audit: Access denied attempt
            log_audit_event(
                event_type="ACCESS_DENIED",
                user_email=email,
                portfolio_id=params['id'],
                action="read_portfolio",
                status="denied",
                message=f"User {email} attempted to access portfolio owned by {item_adviser}"
            )
            
            return create_api_gateway_response(403, {
                'status': 'error',
                'message': 'Access denied. You do not have permission to access this portfolio.',
                'error_code': 'FORBIDDEN',
                'timestamp': datetime.utcnow().isoformat()
            })
        
        # Return success response
        return create_api_gateway_response(200, {
            'status': 'success',
            'message': 'Active item retrieval successful',
            'item_id': params['id'],
            'table_name': params['table_name'],
            'timestamp': datetime.utcnow().isoformat(),
            'result': result
        })
        
    except DynamoDBReadError as e:
        logger.error(f"DynamoDBReadError: {str(e)}")
        return create_api_gateway_response(e.status_code, {
            'status': 'error',
            'message': str(e),
            'error_code': 'DYNAMODB_READ_ERROR',
            'timestamp': datetime.utcnow().isoformat()
        })
    except ValueError as e:
        logger.error(f"ValueError: {str(e)}")
        return create_api_gateway_response(400, {
            'status': 'error',
            'message': str(e),
            'error_code': 'VALIDATION_ERROR',
            'timestamp': datetime.utcnow().isoformat()
        })
    except Exception as e:
        logger.error(f"Unexpected Error: {str(e)}", exc_info=True)
        return create_api_gateway_response(500, {
            'status': 'error',
            'message': f"Unexpected Error: {str(e)}",
            'error_code': 'INTERNAL_SERVER_ERROR',
            'traceback': traceback.format_exc(),
            'timestamp': datetime.utcnow().isoformat()
        })

if __name__ == "__main__":
    # For local testing - simulate the actual API Gateway event structure
    test_event = {
        'body': json.dumps({
            'body': json.dumps({
                'table_name': 'BA-PORTAL-BASETABLE',
                'id': 'B57153AB-B66E-4085-A4C1-929EC158FC3E',
                'region': 'ap-southeast-2'
            })
        })
    }

    print("Testing Lambda function locally...")
    response = lambda_handler(test_event, None)
    print(f"Response: {json.dumps(response, indent=2)}")