#!/usr/bin/env python3
"""
Dynamic DynamoDB Attribute Updater

This script dynamically updates specified attributes of a DynamoDB table by accepting an ID 
and a dictionary of attribute-value pairs. It ensures secure parameterized queries, 
transactional integrity, and comprehensive error handling for database operations, 
with optional logging for audit trails.

Usage:
    python dynamic_update_script.py --table_name TABLE_NAME --id ID --attributes '{"attr1": "value1", "attr2": "value2"}' [--enable_logging]

Features:
- Secure parameterized queries using boto3
- Transactional integrity with DynamoDB transactions
- Comprehensive error handling
- Optional logging for audit trails
- Dynamic attribute updates
"""

import argparse
import json
import logging
import os
import sys
import traceback
from datetime import datetime
from typing import Dict, Any, Optional

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

                # Calculate the chart using 30 years forecast
                chart1_value = borrowing_capacity_forecast_investor_blocks(
                    investors=investors,
                    properties=properties,
                    years=30
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

def parse_arguments() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Dynamic DynamoDB Attribute Updater",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Example usage:
  python dynamic_update_script.py --table_name BA-PORTAL-BASETABLE --id "some-uuid" --attributes '{"status": "inactive", "last_updated_date": "2023-01-01"}' --enable_logging

Attributes should be provided as a JSON string containing key-value pairs.
        """
    )
    
    parser.add_argument(
        "--table_name",
        required=True,
        help="Name of the DynamoDB table to update"
    )
    
    parser.add_argument(
        "--id",
        required=True,
        help="ID of the item to update"
    )
    
    parser.add_argument(
        "--attributes",
        required=True,
        help='JSON string of attributes to update (e.g., {"attr1": "value1", "attr2": "value2"})'
    )
    
    parser.add_argument(
        "--region",
        default="ap-southeast-2",
        help="AWS region (default: ap-southeast-2)"
    )
    
    
    parser.add_argument(
        "--use_transaction",
        action="store_true",
        help="Use DynamoDB transaction for enhanced integrity"
    )
    
    return parser.parse_args()

def main():
    """Main function to execute the DynamoDB update."""
    try:
        # Parse command line arguments
        args = parse_arguments()
        
        # Parse attributes from JSON
        try:
            attributes = json.loads(args.attributes)
        except json.JSONDecodeError as e:
            print(f"Error parsing attributes JSON: {str(e)}")
            sys.exit(1)
        
        # Initialize updater
        updater = DynamoDBUpdater(
            table_name=args.table_name,
            region=args.region
        )
        
        # Check if item exists
        if not updater.check_item_exists(args.id):
            print(f"Error: Item with ID '{args.id}' does not exist in table '{args.table_name}'")
            sys.exit(1)
        
        # Perform update
        if args.use_transaction:
            result = updater.update_item_with_transaction(args.id, attributes)
        else:
            result = updater.update_item(args.id, attributes)
        
        print("Update successful!")
        print(f"Updated item ID: {args.id}")
        print(f"Updated attributes: {list(attributes.keys())}")
        
        return 0
        
    except DynamoDBUpdateError as e:
        print(f"DynamoDB Update Error: {str(e)}")
        sys.exit(1)
        
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        sys.exit(1)

if __name__ == "__main__":
    main()