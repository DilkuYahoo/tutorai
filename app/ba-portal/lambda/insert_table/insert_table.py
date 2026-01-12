#!/usr/bin/env python3
"""
Lambda Function for DynamoDB Table Insert

This Lambda function inserts new items into a DynamoDB table with support for single item
insertion, batch insertion, and conditional writes. It includes comprehensive error handling,
proper logging, and AWS SDK integration.

API Gateway Integration:
- Accepts JSON payload with table_name, item data, and optional conditions
- Returns proper API Gateway responses with status codes and JSON bodies

Features:
- Secure parameterized queries using boto3
- Support for single item insertion
- Support for batch item insertion
- Conditional writes with validation
- Comprehensive error handling
- Proper logging and monitoring
"""

import json
import logging
import os
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, List
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError, BotoCoreError

class DynamoDBInserter:
    def __init__(self, table_name: str, region: str = "ap-southeast-2"):
        """Initialize the DynamoDB inserter with table name and region."""
        self.table_name = table_name
        self.region = region
        
        # Initialize DynamoDB resource
        self.dynamodb = boto3.resource('dynamodb', region_name=self.region)
        self.table = self.dynamodb.Table(self.table_name)
     
    def log(self, message: str, level: str = "info") -> None:
        """Log messages to console (file logging removed for container compatibility)."""
        if level.lower() == "info":
            print(f"[INFO] {message}")
        elif level.lower() == "error":
            print(f"[ERROR] {message}", file=sys.stderr)
        elif level.lower() == "warning":
            print(f"[WARNING] {message}", file=sys.stderr)
        else:
            print(f"[DEBUG] {message}")
     
    def validate_item(self, item: Dict[str, Any]) -> bool:
        """Validate that item is in a proper format for DynamoDB insertion."""
        if not item:
            raise ValueError("Item dictionary cannot be empty")
        
        if not isinstance(item, dict):
            raise ValueError("Item must be a dictionary")
        
        # Check for required 'id' field
        if 'id' not in item:
            raise ValueError("Item must contain an 'id' field as primary key")
        
        # Validate id field
        item_id = item['id']
        if not item_id or not isinstance(item_id, str):
            raise ValueError("Item ID must be a non-empty string")
        
        # DynamoDB has restrictions on attribute names
        for attr_name, attr_value in item.items():
            if not attr_name or not isinstance(attr_name, str):
                raise ValueError(f"Invalid attribute name: {attr_name}")
            
            if len(attr_name) > 255:
                raise ValueError(f"Attribute name too long (max 255 chars): {attr_name}")
        
        return True
    
    def insert_item(self, item: Dict[str, Any], condition_expression: Optional[str] = None) -> Dict[str, Any]:
        """Insert a single item into DynamoDB."""
        try:
            # Validate item
            self.validate_item(item)
            
            # Add system attributes
            current_time = datetime.now().isoformat()
            item['created_date'] = current_time
            item['last_updated_date'] = current_time
            item['number_of_updates'] = 0
            
            # Log the insertion attempt
            self.log(f"Attempting to insert item {item['id']} into table {self.table_name}")
            
            # Prepare insert parameters
            insert_params = {
                'Item': item
            }
            
            # Add condition expression if provided
            if condition_expression:
                insert_params['ConditionExpression'] = condition_expression
            
            # Perform the insert operation
            response = self.table.put_item(**insert_params)
            
            # Log successful insertion
            self.log(f"Successfully inserted item {item['id']}")
            
            return item
            
        except ClientError as e:
            error_msg = f"DynamoDB ClientError inserting item {item.get('id', 'unknown')}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBInsertError(error_msg) from e
            
        except BotoCoreError as e:
            error_msg = f"DynamoDB BotoCoreError inserting item {item.get('id', 'unknown')}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBInsertError(error_msg) from e
            
        except Exception as e:
            error_msg = f"Unexpected error inserting item {item.get('id', 'unknown')}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBInsertError(error_msg) from e
    
    def batch_insert_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Insert multiple items into DynamoDB in a batch operation."""
        try:
            # Validate input
            if not items or not isinstance(items, list):
                raise ValueError("Items must be a non-empty list")
            
            if len(items) > 25:
                raise ValueError("Batch insert operation supports maximum 25 items")
            
            # Validate all items
            for item in items:
                self.validate_item(item)
            
            # Add system attributes to all items
            current_time = datetime.now().isoformat()
            for item in items:
                item['created_date'] = current_time
                item['last_updated_date'] = current_time
                item['number_of_updates'] = 0
            
            # Log the batch insertion attempt
            self.log(f"Attempting to insert {len(items)} items into table {self.table_name}")
            
            # Prepare batch write request
            with self.dynamodb.batch_write() as batch:
                for item in items:
                    batch.put_item(
                        TableName=self.table_name,
                        Item=item
                    )
            
            # Log successful batch insertion
            self.log(f"Successfully inserted {len(items)} items")
            
            return items
            
        except ClientError as e:
            error_msg = f"DynamoDB ClientError in batch insert operation: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBInsertError(error_msg) from e
            
        except Exception as e:
            error_msg = f"Unexpected error in batch insert operation: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBInsertError(error_msg) from e
    
    def check_item_exists(self, item_id: str) -> bool:
        """Check if an item exists in the table."""
        try:
            response = self.table.get_item(Key={'id': item_id})
            return 'Item' in response
        except ClientError as e:
            error_msg = f"Error checking existence of item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBInsertError(error_msg) from e

class DynamoDBInsertError(Exception):
    """Custom exception for DynamoDB insert errors."""
    pass

def parse_lambda_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Parse Lambda event from API Gateway."""
    try:
        # Handle API Gateway proxy integration format
        if 'body' in event:
            body = event['body']
            # Parse JSON body if it's a string
            if isinstance(body, str):
                body_data = json.loads(body)
            else:
                body_data = body
        else:
            body_data = event
        
        # Extract required parameters
        table_name = body_data.get('table_name')
        item = body_data.get('item')
        items = body_data.get('items', [])
        condition_expression = body_data.get('condition_expression')
        region = body_data.get('region', "ap-southeast-2")
        
        # Validate required parameters
        if not table_name:
            raise ValueError("Missing required parameter: table_name")
        
        # If single item is provided
        if item:
            if not isinstance(item, dict):
                raise ValueError("Item must be a dictionary")
            return {
                'table_name': table_name,
                'item': item,
                'condition_expression': condition_expression,
                'region': region,
                'operation': 'insert_item'
            }
        
        # If multiple items are provided
        elif items:
            if not isinstance(items, list):
                raise ValueError("Items must be a list")
            return {
                'table_name': table_name,
                'items': items,
                'region': region,
                'operation': 'batch_insert_items'
            }
        
        else:
            raise ValueError("Either item or items must be provided")
        
    except json.JSONDecodeError as e:
        raise ValueError(f"Error parsing JSON body: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error parsing Lambda event: {str(e)}")

class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Decimal objects."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            # Convert Decimal to float for JSON serialization
            return float(obj)
        # Let the base class default method raise the TypeError
        return super().default(obj)

def create_api_gateway_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Create proper API Gateway response format."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': True
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Lambda function handler for DynamoDB insert operations."""
    try:
        # Parse Lambda event
        params = parse_lambda_event(event)
        
        # Initialize inserter
        inserter = DynamoDBInserter(
            table_name=params['table_name'],
            region=params['region']
        )
        
        # Perform the appropriate operation
        if params['operation'] == 'insert_item':
            # Check if item already exists
            if inserter.check_item_exists(params['item']['id']):
                return create_api_gateway_response(409, {
                    'status': 'error',
                    'message': f"Item with ID '{params['item']['id']}' already exists in table '{params['table_name']}'"
                })
            
            result = inserter.insert_item(
                params['item'],
                params.get('condition_expression')
            )
            
            # Return success response
            return create_api_gateway_response(201, {
                'status': 'success',
                'message': 'Item insertion successful',
                'item_id': params['item']['id'],
                'result': result
            })
        
        elif params['operation'] == 'batch_insert_items':
            result = inserter.batch_insert_items(params['items'])
            
            # Return success response
            return create_api_gateway_response(201, {
                'status': 'success',
                'message': 'Batch insertion successful',
                'items_inserted': len(result),
                'result': result
            })
        
        else:
            return create_api_gateway_response(400, {
                'status': 'error',
                'message': f'Unknown operation: {params["operation"]}'
            })
            
    except DynamoDBInsertError as e:
        return create_api_gateway_response(400, {
            'status': 'error',
            'message': str(e)
        })
    except ValueError as e:
        return create_api_gateway_response(400, {
            'status': 'error',
            'message': str(e)
        })
    except Exception as e:
        return create_api_gateway_response(500, {
            'status': 'error',
            'message': f"Unexpected Error: {str(e)}",
            'traceback': traceback.format_exc()
        })