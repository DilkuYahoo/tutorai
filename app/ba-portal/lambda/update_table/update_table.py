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
from libs.superchart1 import borrowing_capacity_forecast_investor_blocks, set_config_params, reset_config_to_defaults

# CloudWatch Logs for audit trail
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
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
    
    # Also print for visibility in Lambda
    print(f"AUDIT: {event_type} - user={user_email or 'anonymous'} action={action} status={status}")

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
            
            # Make a copy of attributes for processing
            attributes_to_update = attributes.copy()
            
            # Calculate chart1 value ONLY if investors and properties are provided
            if 'investors' in attributes_to_update and 'properties' in attributes_to_update:
                chart1_value = self.calculate_chart1_value(attributes_to_update)
                if chart1_value is not None:
                    attributes_to_update['chart1'] = chart1_value
                    self.log("Adding chart1 attribute to update")
            else:
                self.log("Skipping chart1 calculation - investors or properties not provided")
            
            # Ensure all numeric values are properly handled for DynamoDB
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
        elif isinstance(value, (int, float, Decimal)):
            # Convert numbers to strings for DynamoDB N type (supports decimals)
            return {'N': str(value)}
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
            raise DynamoDBUpdateError(error_msg)
    
    def create_item(self, item_id: str, attributes: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new item in DynamoDB with the specified attributes."""
        try:
            # Ensure all numeric values are properly handled
            attributes_to_create = self._ensure_integer_values(attributes.copy())
            
            # Add required id field
            attributes_to_create['id'] = item_id
            
            # Add system attributes
            attributes_to_create['number_of_updates'] = 1
            attributes_to_create['last_updated_date'] = datetime.now().isoformat()
            
            self.log(f"Creating new item {item_id} with attributes: {list(attributes.keys())}")
            
            response = self.table.put_item(
                Item=attributes_to_create,
                ReturnValues="ALL_OLD"
            )
            
            self.log(f"Successfully created item {item_id}")
            return response
            
        except ClientError as e:
            error_msg = f"DynamoDB ClientError creating item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e
        
        except Exception as e:
            error_msg = f"Unexpected error creating item {item_id}: {str(e)}"
            self.log(error_msg, "error")
            raise DynamoDBUpdateError(error_msg) from e

    def get_config_params(self) -> Dict[str, Any]:
        """Get configuration parameters from DynamoDB config item."""
        try:
            # Try to get the config item
            response = self.table.get_item(Key={'id': 'config'})
            item = response.get('Item', {})
            
            if item:
                config = {}
                # Map DynamoDB attributes to config params
                if 'medicare_levy_rate' in item:
                    config['medicare_levy_rate'] = float(item['medicare_levy_rate'])
                if 'cpi_rate' in item:
                    config['cpi_rate'] = float(item['cpi_rate'])
                if 'accessible_equity_rate' in item:
                    config['accessible_equity_rate'] = float(item['accessible_equity_rate'])
                if 'borrowing_power_multiplier_min' in item:
                    config['borrowing_power_multiplier_min'] = float(item['borrowing_power_multiplier_min'])
                if 'borrowing_power_multiplier_base' in item:
                    config['borrowing_power_multiplier_base'] = float(item['borrowing_power_multiplier_base'])
                if 'borrowing_power_multiplier_dependant_reduction' in item:
                    config['borrowing_power_multiplier_dependant_reduction'] = float(item['borrowing_power_multiplier_dependant_reduction'])
                
                self.log(f"Loaded config params from DynamoDB: {config}")
                return config
            else:
                self.log("No config item found in DynamoDB, using defaults")
                return {}
                
        except ClientError as e:
            error_msg = f"Error retrieving config from DynamoDB: {str(e)}"
            self.log(error_msg, "warning")
            return {}  # Return empty dict to use defaults

    def calculate_chart1_value(self, attributes: Dict[str, Any]) -> Optional[Dict]:
        """Calculate chart1 value using superchart1 library if investors and properties are provided."""
        try:
            # First, load config params from DynamoDB
            config_params = self.get_config_params()
            self.log(f"DEBUG: Loaded config params from DynamoDB: {config_params}")
            
            # Apply config to superchart1 library
            if config_params:
                set_config_params(config_params)
                self.log(f"DEBUG: Applied config params to superchart1: {config_params}")
            else:
                reset_config_to_defaults()
                self.log("DEBUG: No config found, using defaults")
            
            # Check if both investors and properties are in the attributes
            if 'investors' in attributes and 'properties' in attributes:
                self.log(f"DEBUG: Investors count: {len(attributes['investors'])}")
                self.log(f"DEBUG: Properties count: {len(attributes['properties'])}")
                
                # Create deep copies to avoid modifying the original data
                import copy
                investors = copy.deepcopy(attributes['investors'])
                properties = copy.deepcopy(attributes['properties'])

                # Handle case where investors is stored as a dict keyed by name
                if isinstance(investors, dict):
                    investors = list(investors.values())

                # Reconcile stale investor names in property splits.
                # When an investor is renamed the investors array has the new name but
                # investor_splits in properties may still carry the old name, causing
                # a KeyError in the chart calculation.  Fix: for each property, find
                # splits that reference an unknown name and remap them to the investor
                # name that has no matching split (positional / by elimination).
                investor_name_set = {inv['name'] for inv in investors}
                for prop in properties:
                    splits = prop.get('investor_splits', [])
                    stale_splits = [s for s in splits if s.get('name') not in investor_name_set]
                    if stale_splits:
                        covered = {s['name'] for s in splits if s.get('name') in investor_name_set}
                        uncovered = [n for n in [inv['name'] for inv in investors] if n not in covered]
                        for stale_split, new_name in zip(stale_splits, uncovered):
                            self.log(f"Remapping stale split name '{stale_split.get('name')}' -> '{new_name}' in property '{prop.get('name')}'")
                            stale_split['name'] = new_name
                        # Remove any stale splits that couldn't be remapped (e.g. single-investor
                        # portfolio where the only investor already has a split entry).
                        remapped = set(new_name for _, new_name in zip(stale_splits, uncovered))
                        still_stale = {s.get('name') for s in stale_splits} - remapped
                        if still_stale:
                            prop['investor_splits'] = [s for s in splits if s.get('name') not in still_stale]
                            self.log(f"Removed unresolvable stale splits {still_stale} from property '{prop.get('name')}')")

                self.log(f"DEBUG: Processing {len(investors)} investors")
                for inv in investors:
                    self.log(f"DEBUG: Investor: {inv.get('name', 'unknown')}, income: {inv.get('base_income')}, dependants: {inv.get('dependants')}")

                self.log(f"DEBUG: Processing {len(properties)} properties")
                for prop in properties:
                    self.log(f"DEBUG: Property: {prop.get('name', 'unknown')}, value: {prop.get('property_value')}, loan: {prop.get('loan_amount')}")

                # Convert integer rates back to floats for the calculation
                # (since DynamoDB doesn't support floats, we store as integers but need floats for calculation)
                for investor in investors:
                    if 'annual_growth_rate' in investor:
                        original_rate = investor['annual_growth_rate']
                        investor['annual_growth_rate'] = investor['annual_growth_rate'] / 100.0
                        self.log(f"DEBUG: Converted investor {investor.get('name')} growth rate: {original_rate} -> {investor['annual_growth_rate']}")

                for property_data in properties:
                    if 'interest_rate' in property_data:
                        original_rate = property_data['interest_rate']
                        property_data['interest_rate'] = property_data['interest_rate'] / 100.0
                        self.log(f"DEBUG: Converted property {property_data.get('name')} interest rate: {original_rate} -> {property_data['interest_rate']}")
                    if 'growth_rate' in property_data:
                        original_rate = property_data['growth_rate']
                        property_data['growth_rate'] = property_data['growth_rate'] / 100.0
                        self.log(f"DEBUG: Converted property {property_data.get('name')} growth rate: {original_rate} -> {property_data['growth_rate']}")

                # Get investment_years from attributes, default to 30 if not provided
                investment_years = attributes.get('investment_years', 30)
                
                # Get portfolio-level dependants from attributes
                portfolio_dependants = attributes.get('portfolio_dependants', 0)
                portfolio_dependants_events = attributes.get('portfolio_dependants_events', [])
                
                self.log(f"DEBUG: Using investment_years: {investment_years}")
                self.log(f"DEBUG: Using portfolio_dependants: {portfolio_dependants}")
                self.log(f"DEBUG: Using portfolio_dependants_events: {portfolio_dependants_events}")
                
                # Calculate the chart using user-specified years forecast
                self.log("DEBUG: Calling borrowing_capacity_forecast_investor_blocks...")
                chart1_value = borrowing_capacity_forecast_investor_blocks(
                    investors=investors,
                    properties=properties,
                    years=investment_years,
                    portfolio_dependants=portfolio_dependants,
                    portfolio_dependants_events=portfolio_dependants_events
                )
                self.log(f"DEBUG: Calculation returned {len(chart1_value) if chart1_value else 0} years of data")

                # Convert all float values to integers for DynamoDB compatibility
                # DynamoDB doesn't support float types, so we need to convert them
                chart1_value = self._convert_chart_floats_to_integers(chart1_value)

                # Debug: log the converted chart1 value to ensure no floats remain
                self.log(f"Chart1 value type check: {self._check_for_floats(chart1_value)}")
                
                # Debug: Log a sample of the buy_score data
                if chart1_value and len(chart1_value) > 0:
                    first_year = chart1_value[0]
                    self.log(f"DEBUG: First year buy_score components:")
                    self.log(f"  buy_score: {first_year.get('buy_score')}")
                    self.log(f"  buy_score_equity_ratio: {first_year.get('buy_score_equity_ratio')}")
                    self.log(f"  buy_score_borrowing_ratio: {first_year.get('buy_score_borrowing_ratio')}")
                    self.log(f"  buy_score_dti: {first_year.get('buy_score_dti')}")
                    self.log(f"  accessible_equity: {first_year.get('accessible_equity')}")
                    self.log(f"  combined_borrowing_capacity: {first_year.get('combined_borrowing_capacity')}")
                    self.log(f"  current_dti: {first_year.get('current_dti')}")
                
                self.log("Successfully calculated chart1 value")
                return chart1_value
            
            return None
            
        except Exception as e:
            error_msg = f"Error calculating chart1 value: {str(e)}"
            self.log(error_msg, "error")
            return None

    def _ensure_integer_values(self, data: Any) -> Any:
        """Recursively convert float values to Decimal for DynamoDB compatibility.
        
        DynamoDB boto3 client requires Decimal types for numbers, not Python floats.
        """
        if isinstance(data, float):
            return Decimal(str(data))
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
        """Recursively convert float values to integers in chart data for DynamoDB compatibility.
        
        Note: dti_ratio is preserved as a decimal since it represents a ratio, not an integer.
        """
        if isinstance(chart_data, float):
            # Convert float to integer (round to nearest integer)
            return round(chart_data)
        elif isinstance(chart_data, dict):
            # Recursively process dictionary values
            result = {}
            for key, value in chart_data.items():
                # Preserve dti_ratio as decimal (ratio), not as integer
                if key == 'dti_ratio' and isinstance(value, float):
                    result[key] = value  # Keep as decimal
                else:
                    result[key] = self._convert_chart_floats_to_integers(value)
            return result
        elif isinstance(chart_data, list):
            # Recursively process list items
            return [self._convert_chart_floats_to_integers(item) for item in chart_data]
        else:
            # Return other types unchanged
            return chart_data

class DynamoDBUpdateError(Exception):
    """Custom exception for DynamoDB update errors."""
    pass

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
        
        if email:
            print(f"[INFO] Extracted user email from JWT: {email}")
        
        return email
    except Exception as e:
        print(f"[WARNING] Could not extract user from event: {e}")
        return None


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
        # Extract user from API Gateway authorizer context (already validated by API Gateway)
        email = extract_user_from_event(event)
        
        if not email:
            print("[WARNING] No user email found in JWT - authentication required")
            
            # Audit: Failed authentication
            log_audit_event(
                event_type="AUTH_FAILURE",
                user_email="",
                portfolio_id=event.get('body',{}).get('id','unknown'),
                action="update_portfolio",
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
        
        # Initialize updater
        updater = DynamoDBUpdater(
            table_name=params['table_name'],
            region=params['region']
        )
        
        # Validate portfolio ownership - user can only update their own portfolios
        # First, get the existing item to check ownership
        existing_item = updater._get_item(params['id'])
        if existing_item:
            item_adviser = existing_item.get('adviser_name', '')
            if item_adviser and item_adviser.lower() != email.lower():
                print(f"[WARNING] User {email} attempted to update portfolio owned by {item_adviser}")
                
                # Audit: Access denied
                log_audit_event(
                    event_type="ACCESS_DENIED",
                    user_email=email,
                    portfolio_id=params['id'],
                    action="update_portfolio",
                    status="denied",
                    message=f"User {email} attempted to update portfolio owned by {item_adviser}"
                )
                
                return create_api_gateway_response(403, {
                    'status': 'error',
                    'message': 'Access denied. You do not have permission to update this portfolio.',
                    'error_code': 'FORBIDDEN',
                    'timestamp': datetime.utcnow().isoformat()
                })
        
        # Log what we're about to do
        updater.log(f"Received attributes to save: {params['attributes']}")
        
        # Check if item exists
        if not updater.check_item_exists(params['id']):
            # Item doesn't exist, create it with the attributes
            updater.log(f"Item {params['id']} does not exist, creating new item")
            result = updater.create_item(params['id'], params['attributes'])
            
            # Audit: Successful creation
            log_audit_event(
                event_type="PORTFOLIO_CREATE",
                user_email=email,
                portfolio_id=params['id'],
                action="create_portfolio",
                status="success",
                message=f"Created new portfolio with attributes: {list(params['attributes'].keys())}"
            )
            
            return create_api_gateway_response(201, {
                'status': 'success',
                'message': 'Item created successfully',
                'item_id': params['id'],
                'created_attributes': list(params['attributes'].keys()),
                'result': result
            })
        
        # Perform update
        if params['use_transaction']:
            result = updater.update_item_with_transaction(params['id'], params['attributes'])
        else:
            result = updater.update_item(params['id'], params['attributes'])
        
        # Audit: Successful update
        log_audit_event(
            event_type="PORTFOLIO_UPDATE",
            user_email=email,
            portfolio_id=params['id'],
            action="update_portfolio",
            status="success",
            message=f"Updated portfolio with attributes: {list(params['attributes'].keys())}"
        )
        
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