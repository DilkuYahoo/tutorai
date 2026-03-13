"""
BA Agent Lambda Function - Property Attribute Generation

This Lambda function reads pre-calculated chart1 financial data from DynamoDB,
passes it to AWS Bedrock to generate recommended property attributes,
and returns the results to the frontend for user review and persistence.

Supports two actions:
- "add": Generate a new property recommendation based on current portfolio
- "optimize": Optimize existing properties with market benchmarks
"""

import json
import os
import boto3
import logging
import re
from decimal import Decimal
from typing import Dict, List, Any, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# CORS headers for API Gateway
CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
}

# Bedrock client import
try:
    from lib.bedrock_client import invoke_bedrock
except ImportError:
    # Fallback if bedrock_client is not available
    def invoke_bedrock(system_prompt: str, user_prompt: str, model_kwargs: dict = None, region: str = "ap-southeast-2") -> str:
        """Fallback invoke_bedrock function."""
        logger.warning("Using fallback Bedrock invocation - no actual AI call will be made")
        return '{"error": "Bedrock client not available"}'


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Decimal objects."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def get_data_from_dynamodb(table_name: str, item_id: str, region: str = "ap-southeast-2") -> dict:
    """
    Fetch investors, properties, and chart1 data from DynamoDB by ID.
    
    Args:
        table_name: Name of the DynamoDB table
        item_id: The ID of the item to retrieve
        region: AWS region (default: ap-southeast-2)
    
    Returns:
        Dictionary with investors, properties, chart1, and status
    """
    logger.info(f"Fetching data from DynamoDB - table: {table_name}, id: {item_id}, region: {region}")
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    table = dynamodb.Table(table_name)
    
    response = table.get_item(Key={'id': item_id})
    
    if 'Item' not in response:
        logger.error(f"Item with ID '{item_id}' not found in table '{table_name}'")
        raise ValueError(f"Item with ID '{item_id}' not found in table '{table_name}'")
    
    item = response['Item']
    
    # Check if status is active
    status = item.get('status', '')
    if status != 'active':
        logger.error(f"Item with ID '{item_id}' has status '{status}', only 'active' items can be retrieved")
        raise ValueError(f"Item with ID '{item_id}' has status '{status}', only 'active' items can be retrieved")
    
    logger.info(f"Successfully retrieved item '{item_id}'")
    
    return {
        'investors': item.get('investors', []),
        'properties': item.get('properties', []),
        'chart1': item.get('chart1', {}),
        'status': status
    }


def extract_metrics_from_chart1(chart1_data: dict) -> dict:
    """
    Extract key financial metrics from pre-calculated chart1 timeline.
    
    Args:
        chart1_data: The chart1 data from DynamoDB (can be dict with yearly_forecast or a list)
    
    Returns:
        Dictionary with extracted metrics
    """
    if not chart1_data:
        return {}
    
    # Handle case where chart1_data is a list (direct yearly_forecast)
    if isinstance(chart1_data, list):
        yearly_forecast = chart1_data
    else:
        yearly_forecast = chart1_data.get('yearly_forecast', [])
    
    if not yearly_forecast:
        return {}
    
    # Get latest year data (first year for current metrics)
    current_data = yearly_forecast[0]
    
    # Calculate aggregate metrics
    total_property_values = sum(current_data.get('property_values', {}).values())
    total_loan_balances = sum(current_data.get('property_loan_balances', {}).values())
    total_equity = total_property_values - total_loan_balances
    
    # Get DTI metrics
    dti_ratios = [yr.get('dti_ratio', 0) for yr in yearly_forecast if 'dti_ratio' in yr]
    current_dti = current_data.get('dti_ratio', 0)
    min_dti = min(dti_ratios) if dti_ratios else 0
    
    # Get accessible equity metrics
    accessible_equities = [yr.get('accessible_equity', 0) for yr in yearly_forecast if 'accessible_equity' in yr]
    max_accessible_equity = max(accessible_equities) if accessible_equities else 0
    
    # Get borrowing capacities
    borrowing_capacities = current_data.get('investor_borrowing_capacities', {})
    
    # Get other metrics
    household_surplus = current_data.get('household_surplus', 0)
    property_cashflow = current_data.get('property_cashflow', 0)
    
    return {
        'current_dti': current_dti,
        'min_dti': min_dti,
        'max_accessible_equity': max_accessible_equity,
        'total_equity': total_equity,
        'total_property_values': total_property_values,
        'total_loan_balances': total_loan_balances,
        'borrowing_capacity': sum(borrowing_capacities.values()),
        'investor_borrowing_capacities': borrowing_capacities,
        'household_surplus': household_surplus,
        'property_cashflow': property_cashflow,
        'yearly_forecast': yearly_forecast
    }


def format_investor_details(investors: List[dict]) -> str:
    """Format investor details for the prompt."""
    lines = []
    for inv in investors:
        name = inv.get('name', 'Unknown')
        base_income = inv.get('base_income', 0)
        growth_rate = inv.get('annual_growth_rate', 0)
        essential = inv.get('essential_expenditure', 0)
        nonessential = inv.get('nonessential_expenditure', 0)
        
        lines.append(f"- {name}: Base Income ${base_income:,.0f}, Growth {growth_rate*100}%, "
                    f"Essential ${essential:,.0f}, Non-essential ${nonessential:,.0f}")
    return "\n".join(lines) if lines else "No investors"


def format_existing_properties(properties: List[dict]) -> str:
    """Format existing properties for the prompt."""
    if not properties:
        return "No existing properties"
    
    lines = []
    for prop in properties:
        name = prop.get('name', 'Unknown')
        purchase_year = prop.get('purchase_year', 0)
        value = prop.get('property_value', 0) or prop.get('initial_value', 0)
        loan = prop.get('loan_amount', 0)
        rent = prop.get('rent', 0)
        
        lines.append(f"- {name}: Purchase Year {purchase_year}, Value ${value:,.0f}, "
                    f"Loan ${loan:,.0f}, Rent ${rent:,.0f}/yr")
    return "\n".join(lines)


def build_property_prompt(
    investors: List[dict],
    chart1_metrics: dict,
    existing_properties: List[dict],
    property_action: str
) -> Tuple[str, str]:
    """
    Build system and user prompts for property generation or optimization.
    
    Args:
        investors: List of investor data
        chart1_metrics: Extracted financial metrics from chart1
        existing_properties: List of existing properties
        property_action: Either "add" or "optimize"
    
    Returns:
        Tuple of (system_prompt, user_prompt)
    """
    
    # System prompt
    system_prompt = """You are a professional Australian property investment analyst specializing in property acquisition strategy.
Your role is to analyze investor financial capacity and recommend optimal property attributes for investment.

Consider the following financial factors:
1. Debt-to-Income (DTI) Ratio: Target ≤ 30% for sustainable borrowing
2. Borrowing Power: Maximum loan amount based on income and existing debt
3. Loan-to-Value Ratio (LVR): Target ≤ 80% to avoid LMI
4. Cash Flow: Rental income should cover expenses with buffer
5. Equity Position: Accessible equity determines deposit capacity

Output ONLY valid JSON matching the specified schema. No additional text."""
    
    # User prompt based on action
    if property_action == "add":
        user_prompt = f"""FINANCIAL ANALYSIS FOR PROPERTY ATTRIBUTE GENERATION:

EXISTING CHART1 TIMELINE DATA:
{json.dumps(chart1_metrics.get('yearly_forecast', [])[:5], indent=2)}

CURRENT PORTFOLIO STATUS:
- Property Count: {len(existing_properties)}
- Total Property Values: ${chart1_metrics.get('total_property_values', 0):,.2f}
- Total Loan Balances: ${chart1_metrics.get('total_loan_balances', 0):,.2f}
- Total Equity: ${chart1_metrics.get('total_equity', 0):,.2f}

CURRENT FINANCIAL METRICS (Year 1):
- DTI Ratio: {chart1_metrics.get('current_dti', 0):.1f}%
- Accessible Equity: ${chart1_metrics.get('max_accessible_equity', 0):,.2f}
- Household Surplus: ${chart1_metrics.get('household_surplus', 0):,.2f}
- Property Cashflow: ${chart1_metrics.get('property_cashflow', 0):,.2f}

PEAK FINANCIAL METRICS (Over Timeline):
- Max Accessible Equity: ${chart1_metrics.get('max_accessible_equity', 0):,.2f}
- Min DTI: {chart1_metrics.get('min_dti', 0):.1f}%

EXISTING PROPERTIES:
{format_existing_properties(existing_properties)}

INVESTOR DETAILS:
{format_investor_details(investors)}

Based on this financial analysis, recommend property attributes for the NEXT investment property.
Consider:
1. Optimal purchase year when financial capacity is sufficient
2. Loan amount that keeps DTI sustainable
3. Property value within borrowing capacity + accessible equity
4. Rental income that covers costs with positive cashflow
5. Appropriate LVR to avoid LMI

Respond with a JSON object containing:
{{
  "name": "Property X",
  "purchase_year": <year>,
  "loan_amount": <amount>,
  "annual_principal_change": 0,
  "rent": <annual_rent>,
  "interest_rate": <rate>,
  "other_expenses": <expenses>,
  "property_value": <value>,
  "initial_value": <value>,
  "growth_rate": <rate>,
  "investor_splits": [{{"name": "<investor>", "percentage": <percent>}}]
}}"""
    
    else:  # optimize
        user_prompt = f"""FINANCIAL ANALYSIS FOR PORTFOLIO OPTIMIZATION:

EXISTING CHART1 TIMELINE DATA:
{json.dumps(chart1_metrics.get('yearly_forecast', [])[:5], indent=2)}

CURRENT PORTFOLIO STATUS:
- Property Count: {len(existing_properties)}
- Total Property Values: ${chart1_metrics.get('total_property_values', 0):,.2f}
- Total Loan Balances: ${chart1_metrics.get('total_loan_balances', 0):,.2f}
- Total Equity: ${chart1_metrics.get('total_equity', 0):,.2f}

CURRENT FINANCIAL METRICS (Year 1):
- DTI Ratio: {chart1_metrics.get('current_dti', 0):.1f}%
- Accessible Equity: ${chart1_metrics.get('max_accessible_equity', 0):,.2f}
- Household Surplus: ${chart1_metrics.get('household_surplus', 0):,.2f}
- Property Cashflow: ${chart1_metrics.get('property_cashflow', 0):,.2f}

EXISTING PROPERTIES:
{format_existing_properties(existing_properties)}

INVESTOR DETAILS:
{format_investor_details(investors)}

TASK: Analyze the existing properties and perform three key tasks:

1. **VALIDATE**: Review each property and check if numbers are realistic based on Australian market benchmarks:
   - Rent should be 4-6% of property value annually
   - Expenses should be 1-2% of property value annually
   - Growth rates should align with historical averages (3-7%)
   - Interest rates should reflect current market (5-7%)

2. **OPTIMIZE**: Adjust property numbers to be more realistic and sustainable:
   - Suggest realistic rent based on property value and location
   - Adjust expenses to appropriate levels
   - Align growth rates with market expectations
   - Update interest rates to current market rates

3. **RECOMMEND**: Determine if properties should be added or removed to maximize ROI:
   - Consider DTI, LVR, and cashflow constraints
   - Recommend purchase timing for new properties
   - Or recommend selling/holding strategy

Respond with JSON containing:
{{
  "properties": [
    {{
      "name": "<name>",
      "purchase_year": <year>,
      "loan_amount": <amount>,
      "annual_principal_change": 0,
      "rent": <rent>,
      "interest_rate": <rate>,
      "other_expenses": <expenses>,
      "property_value": <value>,
      "initial_value": <value>,
      "growth_rate": <rate>,
      "investor_splits": [{{"name": "<investor>", "percentage": <percent>}}]
    }}
  ],
  "analysis": {{
    "recommended_changes": "<description of changes>",
    "rationale": "<explanation>"
  }}
}}"""
    
    return system_prompt, user_prompt


def parse_property_attributes(response: str) -> dict:
    """
    Parse Bedrock response into property attribute format.
    
    Args:
        response: The raw response from Bedrock
    
    Returns:
        Parsed property object or error dict
    """
    try:
        # Try to find JSON in the response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            parsed = json.loads(json_match.group())
            return parsed
    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error: {e}")
    
    return {"error": "Failed to parse property attributes", "raw_response": response[:500]}


def validate_property_attributes(properties: dict, action: str) -> Tuple[bool, str]:
    """
    Validate property attributes meet business rules.
    
    Args:
        properties: Property or properties object to validate
        action: The action type ("add" or "optimize")
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if action == "add":
        property_obj = properties
        required_fields = ['name', 'purchase_year', 'loan_amount', 'rent', 
                         'interest_rate', 'property_value', 'initial_value', 
                         'growth_rate', 'investor_splits']
        
        for field in required_fields:
            if field not in property_obj:
                return False, f"Missing required field: {field}"
        
        # Validate numeric ranges
        if property_obj.get('purchase_year', 0) < 1:
            return False, "Purchase year must be >= 1"
        
        if property_obj.get('loan_amount', 0) < 0:
            return False, "Loan amount must be positive"
        
        if property_obj.get('interest_rate', 0) < 0 or property_obj.get('interest_rate', 0) > 20:
            return False, "Interest rate must be between 0-20%"
        
        # Validate investor splits total 100%
        splits = property_obj.get('investor_splits', [])
        if splits:
            total_percentage = sum(s.get('percentage', 0) for s in splits)
            if abs(total_percentage - 100) > 1:  # Allow 1% tolerance
                return False, f"Investor splits must total 100%, got {total_percentage}%"
    
    elif action == "optimize":
        if 'properties' not in properties:
            return False, "Missing 'properties' array in optimize response"
        
        if not isinstance(properties.get('properties'), list):
            return False, "'properties' must be an array"
        
        if 'analysis' not in properties:
            return False, "Missing 'analysis' object in optimize response"
    
    return True, ""


def convert_decimal_to_float(obj):
    """Convert Decimal values to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: convert_decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal_to_float(item) for item in obj]
    return obj


def create_response(status_code: int, body: dict) -> dict:
    """
    Create a standardized API Gateway response with CORS headers.
    
    Args:
        status_code: HTTP status code
        body: Response body dictionary
    
    Returns:
        API Gateway compatible response dict
    """
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, cls=DecimalEncoder)
    }


def handle_options_request(event: dict) -> dict:
    """
    Handle OPTIONS preflight request for CORS.
    
    Args:
        event: Lambda event dictionary
    
    Returns:
        API Gateway response for OPTIONS request
    """
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': ''
    }


def lambda_handler(event: dict, context: any) -> dict:
    """
    Lambda function handler for API Gateway.
    
    Expected event format (from API Gateway):
    {
        "httpMethod": "POST",
        "body": "{\"table_name\": \"BA-PORTAL-BASETABLE\", \"id\": \"YOUR-ID-HERE\", \"property_action\": \"add\"}"
    }
    
    Or direct call:
    {
        "table_name": "BA-PORTAL-BASETABLE",
        "id": "YOUR-ID-HERE",
        "property_action": "add"
    }
    
    property_action can be:
    - "add": Generate a new property recommendation
    - "optimize": Optimize existing properties
    """
    logger.info("BA Agent Lambda handler started")
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Handle CORS preflight (OPTIONS) request
    http_method = event.get('httpMethod', '')
    if http_method == 'OPTIONS':
        logger.info("Handling OPTIONS preflight request")
        return handle_options_request(event)
    
    # Parse the event to extract parameters
    body_data = {}
    
    # Handle API Gateway proxy integration format
    if 'body' in event:
        body = event['body']
        if isinstance(body, str):
            try:
                body_data = json.loads(body)
            except json.JSONDecodeError:
                return create_response(400, {
                    'status': 'error', 
                    'message': 'Invalid JSON in body'
                })
        elif isinstance(body, dict):
            body_data = body
    else:
        body_data = event
    
    # Also check query string parameters
    if 'queryStringParameters' in event and isinstance(event['queryStringParameters'], dict):
        body_data.update(event['queryStringParameters'])
    
    # Extract parameters
    table_name = body_data.get('table_name', 'BA-PORTAL-BASETABLE')
    item_id = body_data.get('id')
    region = body_data.get('region', 'ap-southeast-2')
    property_action = body_data.get('property_action', 'add')
    
    logger.info(f"Parameters - table: {table_name}, id: {item_id}, action: {property_action}, region: {region}")
    
    # Validate required parameters
    if not item_id:
        return create_response(400, {
            'status': 'error', 
            'message': 'Missing required parameter: id'
        })
    
    if property_action not in ['add', 'optimize']:
        return create_response(400, {
            'status': 'error', 
            'message': f"Invalid property_action: {property_action}. Must be 'add' or 'optimize'"
        })
    
    # Fetch data from DynamoDB
    try:
        data = get_data_from_dynamodb(table_name, item_id, region)
    except ValueError as e:
        logger.error(f"ValueError: {str(e)}")
        return create_response(404, {
            'status': 'error', 
            'message': str(e)
        })
    except Exception as e:
        logger.error(f"DynamoDB error: {str(e)}")
        return create_response(500, {
            'status': 'error', 
            'message': f'DynamoDB error: {str(e)}'
        })
    
    # Convert Decimal values
    investors = convert_decimal_to_float(data.get('investors', []))
    properties = convert_decimal_to_float(data.get('properties', []))
    chart1 = convert_decimal_to_float(data.get('chart1', {}))
    
    # Extract metrics from chart1
    chart1_metrics = extract_metrics_from_chart1(chart1)
    
    if not chart1_metrics:
        logger.warning("No chart1 data found - proceeding with basic analysis")
        chart1_metrics = {
            'current_dti': 0,
            'min_dti': 0,
            'max_accessible_equity': 0,
            'total_equity': 0,
            'total_property_values': 0,
            'total_loan_balances': 0,
            'borrowing_capacity': 0,
            'household_surplus': 0,
            'property_cashflow': 0,
            'yearly_forecast': []
        }
    
    # Build prompts
    system_prompt, user_prompt = build_property_prompt(
        investors=investors,
        chart1_metrics=chart1_metrics,
        existing_properties=properties,
        property_action=property_action
    )
    
    # Invoke Bedrock
    try:
        logger.info(f"Invoking Bedrock for property_action: {property_action}, region: {region}")
        bedrock_response = invoke_bedrock(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model_kwargs={
                "max_tokens": 2048,
                "temperature": 0.7
            },
            region=region
        )
        logger.info("Bedrock invocation successful")
    except Exception as e:
        logger.error(f"Bedrock invocation error: {str(e)}")
        return create_response(500, {
            'status': 'error',
            'message': f'Bedrock invocation failed: {str(e)}'
        })
    
    # Parse response
    parsed_response = parse_property_attributes(bedrock_response)
    
    # Validate response
    is_valid, error_msg = validate_property_attributes(parsed_response, property_action)
    
    if not is_valid:
        logger.warning(f"Validation warning: {error_msg}")
        # Still return the response but with warning
    
    # Build final response
    if property_action == "add":
        response_body = {
            'status': 'success',
            'action': 'add',
            'property': parsed_response.get('name') and {
                'name': parsed_response.get('name'),
                'purchase_year': parsed_response.get('purchase_year'),
                'loan_amount': parsed_response.get('loan_amount'),
                'annual_principal_change': parsed_response.get('annual_principal_change', 0),
                'rent': parsed_response.get('rent'),
                'interest_rate': parsed_response.get('interest_rate'),
                'other_expenses': parsed_response.get('other_expenses'),
                'property_value': parsed_response.get('property_value'),
                'initial_value': parsed_response.get('initial_value'),
                'growth_rate': parsed_response.get('growth_rate'),
                'investor_splits': parsed_response.get('investor_splits', [])
            } or parsed_response
        }
    else:  # optimize
        response_body = {
            'status': 'success',
            'action': 'optimize',
            'properties': parsed_response.get('properties', []),
            'analysis': parsed_response.get('analysis', {})
        }
    
    return create_response(200, response_body)


# For local testing
if __name__ == "__main__":
    import sys
    
    # Test parameters
    test_id = "B57153AB-B66E-4085-A4C1-929EC158FC3E"
    table_name = "BA-PORTAL-BASETABLE"
    region = "ap-southeast-2"
    
    # Determine action from command line
    action = sys.argv[1] if len(sys.argv) > 1 else "add"
    
    # Create test event (simulating API Gateway format)
    test_event = {
        "httpMethod": "POST",
        "body": json.dumps({
            "table_name": table_name,
            "id": test_id,
            "property_action": action,
            "region": region
        })
    }
    
    print(f"Testing BA Agent Lambda with action: {action}")
    print(f"Event: {json.dumps(test_event, indent=2)}")
    print("-" * 50)
    
    try:
        response = lambda_handler(test_event, None)
        print(f"Response Status: {response['statusCode']}")
        print(f"Response Headers: {response['headers']}")
        print(f"Response Body:\n{json.dumps(json.loads(response['body']), indent=2)}")
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
