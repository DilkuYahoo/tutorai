"""
Sample BA Agent Lambda function that connects to AWS Bedrock
and generates responses, printing output to stdout.
"""

import json
import os
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from decimal import Decimal
from datetime import datetime

# Import Bedrock client library
from lib.bedrock_client import invoke_bedrock


# ============================================================================
# CUSTOM JSON ENCODER FOR DYNAMODB DECIMALS
# ============================================================================

class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles Decimal types from DynamoDB"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


# ============================================================================
# CONFIGURATION VARIABLES
# ============================================================================

# System prompt for Buyers Agent (Real Estate)
SYSTEM_PROMPT = """You are a professional and empathetic Buyers Agent helping clients purchase property. Your role is to:
- Guide clients through every step of the property buying process
- Provide expert advice on market conditions, property values, and investment potential
- Advocate for your client's best interests during negotiations
- Be transparent about costs, risks, and opportunities
- Communicate clearly and compassionately, recognizing that buying a home is a significant life event
- Stay current with real estate laws, market trends, and local property insights
- Help clients make informed decisions that align with their financial goals and lifestyle needs"""

# DynamoDB Configuration
DYNAMODB_TABLE_NAME = os.environ.get("DYNAMODB_TABLE_NAME", "BA-PORTAL-BASETABLE")
DYNAMODB_REGION = os.environ.get("AWS_REGION", "ap-southeast-2")
ITEM_ID = os.environ.get("ITEM_ID", "B57153AB-B66E-4085-A4C1-929EC158FC3E")
CHART_FIELD = os.environ.get("CHART_FIELD", "chart1")
ANALYSIS_FIELD = os.environ.get("ANALYSIS_FIELD", "analysis")

# AWS Bedrock model configuration
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "au.anthropic.claude-sonnet-4-5-20250929-v1:0")
BEDROCK_MODEL_KWARGS = {
    "max_tokens": 2048,
    "temperature": 0.7,
}


# ============================================================================
# DYNAMODB EXTRACTION
# ============================================================================

# Initialize DynamoDB resource with specific region
dynamodb = boto3.resource('dynamodb', region_name=DYNAMODB_REGION)
table = dynamodb.Table(DYNAMODB_TABLE_NAME)

print(f"LOG: Connecting to DynamoDB table: {DYNAMODB_TABLE_NAME} in {DYNAMODB_REGION}")

try:
    print(f"LOG: Fetching item with id: {ITEM_ID}")
    response = table.get_item(Key={'id': ITEM_ID})
    
    if 'Item' in response:
        item = response['Item']
        print(f"LOG: Successfully retrieved item from DynamoDB")
        
        # Extract the chart1 field
        if CHART_FIELD in item:
            portfolio_data = item[CHART_FIELD]
            print(f"LOG: Extracted {CHART_FIELD} field from item")
            print(f"LOG: Chart data type: {type(portfolio_data)}")
            
            # Convert to JSON string using custom encoder to handle Decimals
            portfolio_data_json = json.dumps(portfolio_data, cls=DecimalEncoder)
            print(f"LOG: Portfolio data length: {len(portfolio_data_json)} characters")
        else:
            error_msg = f"ERROR: Field '{CHART_FIELD}' not found in item"
            print(error_msg)
            raise Exception(error_msg)
    else:
        error_msg = f"ERROR: Item with id '{ITEM_ID}' not found in DynamoDB table"
        print(error_msg)
        raise Exception(error_msg)

except NoCredentialsError:
    print("ERROR: AWS credentials not configured")
except ClientError as e:
    print(f"ERROR: DynamoDB client error - {e.response['Error']['Code']}: {e.response['Error']['Message']}")
    raise
except Exception as e:
    print(f"ERROR: Unexpected error retrieving from DynamoDB: {str(e)}")
    raise


# ============================================================================
# GENERATE EXECUTIVE SUMMARY
# ============================================================================

# Build the user input with portfolio data
USER_INPUT = f"""Write an executive summary for the property portfolio based on the following data:

Portfolio Data:
{portfolio_data_json}

Please analyze the portfolio performance and provide:
1. Overall portfolio performance summary
2. Key financial metrics and trends
3. Property value appreciation analysis
4. Debt and equity position over time
5. Recommendations for future strategy"""

# Generate response using the invoke_bedrock function from library
response_text = invoke_bedrock(SYSTEM_PROMPT, USER_INPUT, BEDROCK_MODEL_ID, BEDROCK_MODEL_KWARGS)

# Print the response to stdout
print("=" * 60)
print("BEDROCK GENERATED RESPONSE:")
print("=" * 60)
print(response_text)
print("=" * 60)


# ============================================================================
# UPDATE DYNAMODB WITH ANALYSIS
# ============================================================================

print(f"LOG: Updating DynamoDB item with analysis...")

try:
    # Update the item with the analysis response, last_updated_date, and increment number_of_updates
    update_response = table.update_item(
        Key={'id': ITEM_ID},
        UpdateExpression=f"SET {ANALYSIS_FIELD} = :analysis, last_updated_date = :timestamp, number_of_updates = number_of_updates + :inc",
        ExpressionAttributeValues={
            ':analysis': response_text,
            ':timestamp': datetime.utcnow().isoformat(),
            ':inc': 1
        },
        ReturnValues="UPDATED_NEW"
    )
    
    print(f"LOG: Successfully updated DynamoDB item")
    print(f"LOG: Update response: {update_response['ResponseMetadata']['HTTPStatusCode']}")
    
except ClientError as e:
    print(f"ERROR: Failed to update DynamoDB - {e.response['Error']['Code']}: {e.response['Error']['Message']}")
    raise
except Exception as e:
    print(f"ERROR: Unexpected error updating DynamoDB: {str(e)}")
    raise
