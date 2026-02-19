#!/usr/bin/env python3
"""
Lambda Function for Dynamic DynamoDB Attribute Updater

This Lambda function dynamically updates specified attributes of a DynamoDB table.
It is designed to work with API Gateway and accepts parameters via Lambda event.
It ensures secure parameterized queries, transactional integrity, and comprehensive
error handling for database operations.

API Gateway Integration:
- Accepts JSON payload with table_name, id, attributes, and optional use_transaction
- Returns proper API Gateway responses with status codes and JSON bodies

Features:
- Secure parameterized queries using boto3
- Transactional integrity with DynamoDB transactions
- Comprehensive error handling
- Automatic chart1 calculation when investors and properties are provided
- DynamoDB compatibility with integer-only numeric values
"""

import json
import logging
import os
import sys
import traceback
from datetime import datetime
from typing import Dict, Any, Optional
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError, BotoCoreError

# Import the superchart1 library for chart calculations
from libs.superchart1 import borrowing_capacity_forecast_investor_blocks

class DynamoDBUpdater:
    def __init__(self, table_name: str, region: str = "ap-southeast-2"):
        """Initialize the DynamoDB updater with table name and region."""
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
    
    def validate_attributes(self, attributes: Dict[str, Any]) -> bool:
        """Validate that attributes are in a proper format for DynamoDB."""
        if not attributes:
            raise ValueError("Attributes dictionary cannot be empty")
        
        if not isinstance(attributes, dict):
            raise ValueError("Attributes must be a dictionary")
        
        # Check for valid attribute names and values
        for attr_name, attr_value in attributes.items():
            if not attr_name or not isinstance(attr_name, str):
                raise ValueError(f"Invalid attribute name: {attr_name}")
            
            # DynamoDB has restrictions on attribute names
            if len(attr_name) > 255:
                raise ValueError(f"Attribute name too long (max 255 chars): {attr_name}")
            
            # Check for reserved attribute names
            reserved_names = ['id', 'TABLE_NAME', 'REGION']  # Add more if needed
            if attr_name.lower() in reserved_names:
                raise ValueError(f"Attribute name '{attr_name}' is reserved and cannot be updated")
        
        return True
    
    def build_update_expression(self, attributes: Dict[str, Any]) -> tuple:
        """Build DynamoDB update expression and attribute values."""
        update_expression = "SET "
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        for i, (attr_name, attr_value) in enumerate(attributes.items()):
            # Create attribute name placeholder
            attr_placeholder = f"#attr{i}"
            expression_attribute_names[attr_placeholder] = attr_name
            
            # Create attribute value placeholder
            value_placeholder = f":val{i}"
            expression_attribute_values[value_placeholder] = attr_value
            
            # Add to update expression
            if i > 0:
                update_expression += ", "
            update_expression += f"{attr_placeholder} = {value_placeholder}"
        
        return update_expression, expression_attribute_values, expression_attribute_names
    
    def update_item(self, item_id: str, attributes: Dict[str, Any]) -> Dict[str, Any]:
        """Update an item in DynamoDB with the specified attributes."""
        try:
            # Validate input
            if not item_id or not isinstance(item_id, str):
                raise ValueError("Item ID must be a non-empty string")
            
            self.validate_attributes(attributes)
            
            # Calculate chart1 value if investors and properties are provided
            chart1_value = self.calculate_chart1_value(attributes)
            
            # Add chart1 to attributes if calculated
            attributes_to_update = attributes.copy()
            if chart1_value is not None:
                attributes_to_update['chart1'] = chart1_value
                self.log("Adding chart1 attribute to update")
            
            # Ensure all numeric values are integers for DynamoDB compatibility
            attributes_to_update = self._ensure_integer_values(attributes_to_update)
            
            # Build update expression for user attributes
            user_update_expression, user_expression_attribute_values, user_expression_attribute_names = \
                self.build_update_expression(attributes_to_update)
            
            # Add system attributes (number_of_updates and last_updated_date)
            current_time = datetime.now().isoformat()
            
            # Build complete update expression with system attributes
            update_expression = user_update_expression
            expression_attribute_values = user_expression_attribute_values.copy()
            expression_attribute_names = user_expression_attribute_names.copy()
            
            # Add number_of_updates increment
            if update_expression != "SET ":
                update_expression += ", "
            update_expression += "number_of_updates = number_of_updates + :inc"
            expression_attribute_values[":inc"] = 1
            
            # Add last_updated_date
            update_expression += ", last_updated_date = :now"
            expression_attribute_values[":now"] = current_time
            
            # Log the update attempt
            self.log(f"Attempting to update item {item_id} with attributes: {list(attributes.keys())}")
            
            # Perform the update using transaction for atomicity
            response = self.table.update_item(
                Key={'id': item_id},
                UpdateExpression=update_expression,
                ExpressionAttributeValues=expression_attribute_values,
                ExpressionAttributeNames=expression_attribute_names,
                ReturnValues="ALL_NEW"
            )
            
            # Log successful update
            self.log(f"Successfully updated item {item_id}")
            
            return response.get('Attributes', {})
            
        except ClientError as e:
            error_msg = f"DynamoDB ClientError updating item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e
            
        except BotoCoreError as e:
            error_msg = f"DynamoDB BotoCoreError updating item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e
            
        except Exception as e:
            error_msg = f"Unexpected error updating item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e
    
    def update_item_with_transaction(self, item_id: str, attributes: Dict[str, Any]) -> Dict[str, Any]:
        """Update an item using DynamoDB transaction for enhanced integrity."""
        try:
            # Validate input
            if not item_id or not isinstance(item_id, str):
                raise ValueError("Item ID must be a non-empty string")
            
            self.validate_attributes(attributes)
            
            # Calculate chart1 value if investors and properties are provided
            chart1_value = self.calculate_chart1_value(attributes)
            
            # Add chart1 to attributes if calculated
            attributes_to_update = attributes.copy()
            if chart1_value is not None:
                attributes_to_update['chart1'] = chart1_value
                self.log("Adding chart1 attribute to transactional update")
            
            # Ensure all numeric values are integers for DynamoDB compatibility
            attributes_to_update = self._ensure_integer_values(attributes_to_update)
            
            # Build update expression for user attributes
            user_update_expression, user_expression_attribute_values, user_expression_attribute_names = \
                self.build_update_expression(attributes_to_update)
            
            # Add system attributes (number_of_updates and last_updated_date)
            current_time = datetime.now().isoformat()
            
            # Build complete update expression with system attributes
            update_expression = user_update_expression
            expression_attribute_values = user_expression_attribute_values.copy()
            expression_attribute_names = user_expression_attribute_names.copy()
            
            # Add number_of_updates increment
            if update_expression != "SET ":
                update_expression += ", "
            update_expression += "number_of_updates = number_of_updates + :inc"
            expression_attribute_values[":inc"] = 1
            
            # Add last_updated_date
            update_expression += ", last_updated_date = :now"
            expression_attribute_values[":now"] = current_time
            
            # Use DynamoDB transaction for atomic update
            dynamodb_client = boto3.client('dynamodb', region_name=self.region)
            
            # Log the transaction attempt
            self.log(f"Attempting transactional update for item {item_id}")
            
            response = dynamodb_client.transact_write_items(
                TransactItems=[
                    {
                        'Update': {
                            'TableName': self.table_name,
                            'Key': {'id': {'S': item_id}},
                            'UpdateExpression': update_expression,
                            'ExpressionAttributeValues': {
                                k: self._convert_to_dynamodb_type(v)
                                for k, v in expression_attribute_values.items()
                            },
                            'ExpressionAttributeNames': expression_attribute_names,
                            'ReturnValuesOnConditionCheckFailure': 'ALL_OLD'
                        }
                    }
                ]
            )
            
            # Log successful transaction
            self.log(f"Successfully completed transactional update for item {item_id}")
            
            # Fetch the updated item to return
            return self._get_item(item_id)
            
        except ClientError as e:
            error_msg = f"DynamoDB transaction error updating item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e
            
        except Exception as e:
            error_msg = f"Unexpected transaction error updating item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e
    
    def _convert_to_dynamodb_type(self, value: Any) -> Dict[str, Any]:
        """Convert Python values to DynamoDB attribute types."""
        if value is None:
            return {'NULL': True}
        elif isinstance(value, str):
            return {'S': value}
        elif isinstance(value, bool):
            return {'BOOL': value}
        elif isinstance(value, int):
            return {'N': str(value)}
        elif isinstance(value, float):
            # Convert float to integer for DynamoDB compatibility
            return {'N': str(round(value))}
        elif isinstance(value, list):
            return {'L': [self._convert_to_dynamodb_type(item) for item in value]}
        elif isinstance(value, dict):
            return {'M': {k: self._convert_to_dynamodb_type(v) for k, v in value.items()}}
        else:
            # Convert other types to string
            return {'S': str(value)}
    
    def _get_item(self, item_id: str) -> Dict[str, Any]:
        """Get an item from DynamoDB by ID."""
        try:
            response = self.table.get_item(Key={'id': item_id})
            return response.get('Item', {})
        except ClientError as e:
            error_msg = f"Error retrieving item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e
    
    def check_item_exists(self, item_id: str) -> bool:
        """Check if an item exists in the table."""
        try:
            response = self.table.get_item(Key={'id': item_id})
            return 'Item' in response
        except ClientError as e:
            error_msg = f"Error checking existence of item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e

    def calculate_chart1_value(self, attributes: Dict[str, Any]) -> Optional[Dict]:
        """Calculate chart1 value using superchart1 library if investors and properties are provided."""
        try:
            # Check if both investors and properties are in the attributes
            if 'investors' in attributes and 'properties' in attributes:
                # Create deep copies to avoid modifying the original data
                import copy
                investors = copy.deepcopy(attributes['investors'])
                properties = copy.deepcopy(attributes['properties'])

                # Convert integer rates back to floats for the calculation
                # (since DynamoDB doesn't support floats, we store as integers but need floats for calculation)
                for investor in investors:
                    if 'annual_growth_rate' in investor:
                        investor['annual_growth_rate'] = investor['annual_growth_rate'] / 100.0

                for property_data in properties:
                    if 'interest_rate' in property_data:
                        property_data['interest_rate'] = property_data['interest_rate'] / 100.0
                    if 'growth_rate' in property_data:
                        property_data['growth_rate'] = property_data['growth_rate'] / 100.0

                # Get investment_years from attributes, default to 30 if not provided
                investment_years = attributes.get('investment_years', 30)
                
                # Calculate the chart using user-specified years forecast
                chart1_value = borrowing_capacity_forecast_investor_blocks(
                    investors=investors,
                    properties=properties,
                    years=investment_years
                )

                # Convert all float values to integers for DynamoDB compatibility
                # DynamoDB doesn't support float types, so we need to convert them
                chart1_value = self._convert_chart_floats_to_integers(chart1_value)

                # Debug: log the converted chart1 value to ensure no floats remain
                self.log(f"Chart1 value type check: {self._check_for_floats(chart1_value)}")
                self.log("Successfully calculated chart1 value")
                return chart1_value
            
            return None
            
        except Exception as e:
            error_msg = f"Error calculating chart1 value: {str(e)}"
            self.log(error_msg, "error")
            return None

    def _ensure_integer_values(self, data: Any) -> Any:
        """Recursively ensure all numeric values are integers for DynamoDB compatibility."""
        if isinstance(data, float):
            return round(data)
        elif isinstance(data, dict):
            return {key: self._ensure_integer_values(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._ensure_integer_values(item) for item in data]
        else:
            return data

    def _check_for_floats(self, data: Any) -> bool:
        """Recursively check if any float values exist in the data structure."""
        if isinstance(data, float):
            return True
        elif isinstance(data, dict):
            return any(self._check_for_floats(value) for value in data.values())
        elif isinstance(data, list):
            return any(self._check_for_floats(item) for item in data)
        else:
            return False

    def _convert_chart_floats_to_integers(self, chart_data: Any) -> Any:
        """Recursively convert float values to integers in chart data for DynamoDB compatibility."""
        if isinstance(chart_data, float):
            # Convert float to integer (round to nearest integer)
            return round(chart_data)
        elif isinstance(chart_data, dict):
            # Recursively process dictionary values
            return {key: self._convert_chart_floats_to_integers(value) for key, value in chart_data.items()}
        elif isinstance(chart_data, list):
            # Recursively process list items
            return [self._convert_chart_floats_to_integers(item) for item in chart_data]
        else:
            # Return other types unchanged
            return chart_data

class DynamoDBUpdateError(Exception):
    """Custom exception for DynamoDB update errors."""
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
        item_id = body_data.get('id')
        attributes = body_data.get('attributes', {})
        region = body_data.get('region', "ap-southeast-2")
        use_transaction = body_data.get('use_transaction', False)
        
        # Validate required parameters
        if not table_name:
            raise ValueError("Missing required parameter: table_name")
        if not item_id:
            raise ValueError("Missing required parameter: id")
        if not attributes:
            raise ValueError("Missing required parameter: attributes")
        
        return {
            'table_name': table_name,
            'id': item_id,
            'attributes': attributes,
            'region': region,
            'use_transaction': use_transaction
        }
        
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
    """Lambda function handler for DynamoDB updates."""
    try:
        # Parse Lambda event
        params = parse_lambda_event(event)
        
        # Initialize updater
        updater = DynamoDBUpdater(
            table_name=params['table_name'],
            region=params['region']
        )
        
        # Check if item exists
        if not updater.check_item_exists(params['id']):
            return create_api_gateway_response(404, {
                'status': 'error',
                'message': f"Item with ID '{params['id']}' does not exist in table '{params['table_name']}'"
            })
        
        # Perform update
        if params['use_transaction']:
            result = updater.update_item_with_transaction(params['id'], params['attributes'])
        else:
            result = updater.update_item(params['id'], params['attributes'])
        
        # Return success response
        return create_api_gateway_response(200, {
            'status': 'success',
            'message': 'Update successful',
            'item_id': params['id'],
            'updated_attributes': list(params['attributes'].keys()),
            'result': result
        })
        
    except DynamoDBUpdateError as e:
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