
import json
import os
import boto3
import logging
import re
from decimal import Decimal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from lib.superchart1 import borrowing_capacity_forecast_investor_blocks, calculate_net_income
from lib.bedrock_client import invoke_bedrock


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Decimal objects."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def prepare_chart1_data_for_llm(chart1_results: list, investors: list, properties: list) -> dict:
    """
    Prepare chart1 data for LLM analysis.
    
    Args:
        chart1_results: The yearly forecast results from borrowing_capacity_forecast_investor_blocks
        investors: List of investor data
        properties: List of property data
    
    Returns:
        Dictionary with summarized financial data for LLM
    """
    if not chart1_results:
        return {}
    
    # Get the latest year data (most recent forecast)
    latest_year = chart1_results[-1]
    
    # Calculate total equity across all properties
    total_property_values = sum(latest_year.get('property_values', {}).values())
    total_loan_balances = sum(latest_year.get('property_loan_balances', {}).values())
    total_equity = total_property_values - total_loan_balances
    
    # Get current borrowing capacity
    total_borrowing_capacity = sum(latest_year.get('investor_borrowing_capacities', {}).values())
    
    # Get current debt
    total_debt = latest_year.get('total_debt', 0)
    
    # Get household surplus
    household_surplus = latest_year.get('household_surplus', 0)
    
    # Get property cashflow
    property_cashflow = latest_year.get('property_cashflow', 0)
    
    # Count current properties
    current_property_count = len([p for p in properties if p.get('purchase_year', 999) <= len(chart1_results)])
    
    # Get investor net incomes
    investor_net_incomes = latest_year.get('investor_net_incomes', {})
    
    return {
        'current_year': latest_year.get('year', 1),
        'current_property_count': current_property_count,
        'total_property_values': round(total_property_values, 2),
        'total_loan_balances': round(total_loan_balances, 2),
        'total_equity': round(total_equity, 2),
        'total_borrowing_capacity': round(total_borrowing_capacity, 2),
        'total_debt': round(total_debt, 2),
        'household_surplus': round(household_surplus, 2),
        'property_cashflow': round(property_cashflow, 2),
        'investor_net_incomes': investor_net_incomes,
        'yearly_forecast_summary': [
            {
                'year': yr.get('year'),
                'total_equity': round(sum(yr.get('property_values', {}).values()) - sum(yr.get('property_loan_balances', {}).values()), 2),
                'borrowing_capacity': round(sum(yr.get('investor_borrowing_capacities', {}).values()), 2),
                'household_surplus': round(yr.get('household_surplus', 0), 2),
                'property_cashflow': round(yr.get('property_cashflow', 0), 2)
            }
            for yr in chart1_results[-5:]  # Last 5 years for trend analysis
        ]
    }


def extract_property_count_from_response(response: str) -> int:
    """
    Extract the recommended number of properties from LLM response.
    
    Args:
        response: The LLM response text
    
    Returns:
        Recommended number of properties (default: 0 if not found)
    """
    # Try to find a number in the response
    # Look for patterns like "invest in X properties" or "X properties"
    patterns = [
        r'invest\s+in\s+(\d+)\s+propert(?:y|ies)',
        r'(\d+)\s+propert(?:y|ies)\s+to\s+invest',
        r'recommend\s+(\d+)\s+propert(?:y|ies)',
        r'optimal\s+(?:number\s+of\s+)?propert(?:y|ies)\s*[=:]\s*(\d+)',
        r'(\d+)\s+propert(?:y|ies)\s+is\s+(?:the\s+)?optimal',
        r'purchase\s+(\d+)\s+propert(?:y|ies)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, response, re.IGNORECASE)
        if match:
            return int(match.group(1))
    
    # If no pattern matches, try to find any number in the response
    numbers = re.findall(r'\b(\d+)\b', response)
    if numbers:
        # Return the first reasonable number (1-10)
        for num in numbers:
            if 1 <= int(num) <= 10:
                return int(num)
    
    return 0


def generate_investment_recommendation(
    chart1_data: dict,
    cycle: int,
    previous_recommendation: dict = None
) -> dict:
    """
    Generate investment property recommendation using Bedrock LLM.
    
    Args:
        chart1_data: Prepared chart1 financial data
        cycle: Current iteration cycle (1-3)
        previous_recommendation: Previous recommendation for feedback loop
    
    Returns:
        Dictionary with LLM response and extracted recommendation
    """
    # Build the system prompt
    system_prompt = """You are a professional investment property advisor specializing in Australian property investment.
Your role is to analyze financial data and recommend the optimal number of investment properties to maximize portfolio returns.

Consider the following factors when making recommendations:
1. Borrowing Power: The investor's capacity to borrow based on income and existing debt
2. Equity Building: The ability to build equity through property appreciation and principal repayment
3. Cash Flow: Rental income minus expenses and mortgage payments
4. Risk Management: Ensuring the portfolio is sustainable

Provide clear, data-driven recommendations with specific numbers.

Respond in the following JSON format:
{
    "recommended_properties": <number>,
    "rationale": "<brief explanation>",
    "key_factors_considered": ["<factor1>", "<factor2>"],
    "risk_assessment": "<low/medium/high>",
    "expected_outcomes": "<brief description of expected outcomes>"
}"""
    
    # Build the user prompt with chart1 data
    user_prompt = f"""Analyze the following financial data and recommend the optimal number of investment properties:

CURRENT FINANCIAL SUMMARY:
- Current Property Count: {chart1_data.get('current_property_count', 0)}
- Total Property Values: ${chart1_data.get('total_property_values', 0):,.2f}
- Total Loan Balances: ${chart1_data.get('total_loan_balances', 0):,.2f}
- Total Equity: ${chart1_data.get('total_equity', 0):,.2f}
- Total Borrowing Capacity: ${chart1_data.get('total_borrowing_capacity', 0):,.2f}
- Total Debt: ${chart1_data.get('total_debt', 0):,.2f}
- Household Surplus (Annual): ${chart1_data.get('household_surplus', 0):,.2f}
- Property Cashflow (Annual): ${chart1_data.get('property_cashflow', 0):,.2f}

INVESTOR NET INCOMES:
{json.dumps(chart1_data.get('investor_net_incomes', {}), indent=2)}

YEARLY FORECAST TREND (Last 5 years):
{json.dumps(chart1_data.get('yearly_forecast_summary', []), indent=2)}

"""
    
    # Add previous recommendation context for cycles 2 and 3
    if previous_recommendation:
        user_prompt += f"""
PREVIOUS RECOMMENDATION (Cycle {cycle - 1}):
- Recommended Properties: {previous_recommendation.get('recommended_properties', 'N/A')}
- Previous Rationale: {previous_recommendation.get('rationale', 'N/A')}
- Previous Risk Assessment: {previous_recommendation.get('risk_assessment', 'N/A')}

Please review this recommendation and provide your refined recommendation considering:
1. Is the previous recommendation still optimal given the financial projections?
2. What adjustments would you make and why?
3. Provide the final optimal number of properties to invest in.
"""
    else:
        user_prompt += """
Based on this data, provide your recommendation for the optimal number of investment properties to maximize the portfolio.
Consider the balance between borrowing power utilization, equity building potential, and cash flow sustainability.
"""
    
    logger.info(f"Generating investment recommendation - Cycle {cycle}")
    
    try:
        # Invoke Bedrock LLM
        response = invoke_bedrock(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            model_kwargs={
                "max_tokens": 2048,
                "temperature": 0.5
            }
        )
        
        logger.info(f"Bedrock response received for cycle {cycle}")
        
        # Extract the recommended property count
        recommended_properties = extract_property_count_from_response(response)
        
        # Try to parse JSON from response
        try:
            # Look for JSON in response
            json_match = re.search(r'\{[^{}]*\}', response, re.DOTALL)
            if json_match:
                parsed_response = json.loads(json_match.group())
                return {
                    'cycle': cycle,
                    'llm_response': response,
                    'recommended_properties': parsed_response.get('recommended_properties', recommended_properties),
                    'rationale': parsed_response.get('rationale', ''),
                    'key_factors': parsed_response.get('key_factors_considered', []),
                    'risk_assessment': parsed_response.get('risk_assessment', 'unknown'),
                    'expected_outcomes': parsed_response.get('expected_outcomes', '')
                }
        except (json.JSONDecodeError, AttributeError):
            pass
        
        # Fallback if JSON parsing fails
        return {
            'cycle': cycle,
            'llm_response': response,
            'recommended_properties': recommended_properties,
            'rationale': 'See LLM response for details',
            'key_factors': ['borrowing_power', 'equity_building', 'cash_flow'],
            'risk_assessment': 'unknown',
            'expected_outcomes': response[:200]
        }
        
    except Exception as e:
        logger.error(f"Error generating investment recommendation: {str(e)}")
        return {
            'cycle': cycle,
            'llm_response': f"Error: {str(e)}",
            'recommended_properties': 0,
            'rationale': 'Failed to generate recommendation',
            'key_factors': [],
            'risk_assessment': 'unknown',
            'expected_outcomes': ''
        }


def optimize_property_investment(
    investors: list,
    properties: list,
    years: int,
    max_cycles: int = 3
) -> dict:
    """
    Optimize investment property count using iterative LLM analysis.
    
    Args:
        investors: List of investor data
        properties: List of property data
        years: Number of forecast years
        max_cycles: Maximum number of optimization cycles (default: 3)
    
    Returns:
        Dictionary with optimization results and final recommendation
    """
    logger.info(f"Starting property investment optimization with {max_cycles} cycles")
    
    # Get chart1 data (financial forecast)
    chart1_results = borrowing_capacity_forecast_investor_blocks(
        investors=investors,
        properties=properties,
        years=years
    )
    
    # Prepare data for LLM
    chart1_data = prepare_chart1_data_for_llm(chart1_results, investors, properties)
    
    logger.info(f"Chart1 data prepared - Current properties: {chart1_data.get('current_property_count')}")
    
    # Run optimization loop (max 3 cycles)
    cycle_results = []
    previous_recommendation = None
    
    for cycle in range(1, max_cycles + 1):
        logger.info(f"Optimization cycle {cycle}/{max_cycles}")
        
        # Generate recommendation
        recommendation = generate_investment_recommendation(
            chart1_data=chart1_data,
            cycle=cycle,
            previous_recommendation=previous_recommendation
        )
        
        cycle_results.append(recommendation)
        previous_recommendation = recommendation
        
        logger.info(f"Cycle {cycle} - Recommended properties: {recommendation.get('recommended_properties')}")
        
        # Print cycle output
        print(f"\n{'='*60}")
        print(f"CYCLE {cycle} - INVESTMENT PROPERTY ANALYSIS")
        print(f"{'='*60}")
        print(f"\n📊 FINANCIAL SUMMARY:")
        print(f"   Current Properties: {chart1_data.get('current_property_count', 0)}")
        print(f"   Total Equity: ${chart1_data.get('total_equity', 0):,.2f}")
        print(f"   Borrowing Capacity: ${chart1_data.get('total_borrowing_capacity', 0):,.2f}")
        print(f"   Household Surplus: ${chart1_data.get('household_surplus', 0):,.2f}/year")
        print(f"   Property Cashflow: ${chart1_data.get('property_cashflow', 0):,.2f}/year")
        
        print(f"\n🏠 RECOMMENDATION:")
        print(f"   Properties to Invest: {recommendation.get('recommended_properties', 0)}")
        print(f"   Risk Level: {recommendation.get('risk_assessment', 'N/A').upper()}")
        print(f"   Rationale: {recommendation.get('rationale', 'N/A')[:200]}...")
        
        if recommendation.get('key_factors'):
            print(f"\n🔑 KEY FACTORS CONSIDERED:")
            for factor in recommendation.get('key_factors', []):
                print(f"   - {factor}")
        
        print(f"\n📈 EXPECTED OUTCOMES:")
        print(f"   {recommendation.get('expected_outcomes', 'N/A')[:300]}...")
        
        if previous_recommendation and cycle > 1:
            print(f"\n🔄 PREVIOUS CYCLE COMPARISON:")
            print(f"   Previous Recommendation: {cycle_results[cycle-2].get('recommended_properties', 0)} properties")
            print(f"   Current Recommendation: {recommendation.get('recommended_properties', 0)} properties")
        
        print(f"\n{'='*60}")
    
    # Get the final recommendation (last cycle)
    final_recommendation = cycle_results[-1] if cycle_results else {}
    
    # Print final summary
    print(f"\n{'#'*60}")
    print(f"# FINAL OPTIMIZATION RESULT")
    print(f"#{'='*58}")
    print(f"# Optimal Number of Properties: {final_recommendation.get('recommended_properties', 0)}")
    print(f"# Total Cycles Run: {len(cycle_results)}")
    print(f"# Risk Assessment: {final_recommendation.get('risk_assessment', 'N/A').upper()}")
    print(f"#{'='*58}#")
    print(f"{'#'*60}\n")
    
    return {
        'chart1_results': chart1_results,
        'chart1_data_summary': chart1_data,
        'cycle_results': cycle_results,
        'final_recommendation': {
            'recommended_properties': final_recommendation.get('recommended_properties', 0),
            'rationale': final_recommendation.get('rationale', ''),
            'key_factors': final_recommendation.get('key_factors', []),
            'risk_assessment': final_recommendation.get('risk_assessment', 'unknown'),
            'expected_outcomes': final_recommendation.get('expected_outcomes', '')
        },
        'total_cycles': len(cycle_results)
    }


def get_data_from_dynamodb(table_name: str, item_id: str, region: str = "ap-southeast-2") -> dict:
    """
    Fetch investors, properties, and years from DynamoDB by ID.
    
    Args:
        table_name: Name of the DynamoDB table
        item_id: The ID of the item to retrieve
        region: AWS region (default: ap-southeast-2)
    
    Returns:
        Dictionary with investors, properties, and investment_years
    """
    logger.info(f"get_data_from_dynamodb called with table_name: {table_name}, item_id: {item_id}, region: {region}")
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    table = dynamodb.Table(table_name)
    
    logger.info(f"Querying DynamoDB table: {table_name} with key: {item_id}")
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
    
    logger.info(f"Successfully retrieved item '{item_id}' from table '{table_name}'")
    
    return {
        'investors': item.get('investors', []),
        'properties': item.get('properties', []),
        'investment_years': item.get('investment_years', 30)
    }


def lambda_handler(event: dict, context: any) -> dict:
    """
    Lambda function handler.
    
    Expected event format (from API Gateway):
    {
        "body": "{\"table_name\": \"BA-PORTAL-BASETABLE\", \"id\": \"YOUR-ID-HERE\"}"
    }
    
    Or direct call:
    {
        "table_name": "BA-PORTAL-BASETABLE",
        "id": "YOUR-ID-HERE"
    }
    """
    logger.info("Lambda handler started")
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Parse the event to extract parameters
    body_data = {}
    
    # Handle API Gateway proxy integration format
    if 'body' in event:
        body = event['body']
        if isinstance(body, str):
            try:
                body_data = json.loads(body)
            except json.JSONDecodeError:
                body_data = {}
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
    enable_optimization = body_data.get('enable_optimization', False)  # Enable LLM optimization by default
    max_cycles = min(int(body_data.get('max_cycles', 3)), 3)  # Cap at 3 cycles max
    
    logger.info(f"Extracted parameters - table_name: {table_name}, item_id: {item_id}, region: {region}, enable_optimization: {enable_optimization}, max_cycles: {max_cycles}")
    
    if not item_id:
        logger.error("Missing required parameter: id")
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Missing required parameter: id'})
        }
    
    # Fetch data from DynamoDB
    try:
        logger.info(f"Fetching data from DynamoDB table: {table_name}, item_id: {item_id}")
        data = get_data_from_dynamodb(table_name, item_id, region)
        logger.info(f"Successfully fetched data for item_id: {item_id}")
    except ValueError as e:
        logger.error(f"ValueError while fetching data: {str(e)}")
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }
    except Exception as e:
        logger.error(f"Exception while fetching data: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'DynamoDB error: {str(e)}'})
        }
    
    investors = data['investors']
    properties = data['properties']
    years = int(data['investment_years'])
    
    # Convert Decimal values from DynamoDB to float
    def convert_decimal_to_float(obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, dict):
            return {k: convert_decimal_to_float(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_decimal_to_float(item) for item in obj]
        return obj
    
    investors = convert_decimal_to_float(investors)
    properties = convert_decimal_to_float(properties)
    
    logger.info(f"Processing data - investors count: {len(investors)}, properties count: {len(properties)}, years: {years}")
    
    # Call the borrowing_capacity_forecast_investor_blocks function
    logger.info("Calling borrowing_capacity_forecast_investor_blocks function")
    results = borrowing_capacity_forecast_investor_blocks(
        investors=investors,
        properties=properties,
        years=years
    )
    logger.info("Successfully computed borrowing capacity forecast")
    
    # Prepare response data
    response_data = {
        'id': item_id,
        'investors': investors,
        'properties': properties,
        'years': years,
        'results': results
    }
    
    # Run LLM optimization if enabled
    if enable_optimization:
        logger.info(f"Running LLM optimization with {max_cycles} cycles")
        try:
            optimization_results = optimize_property_investment(
                investors=investors,
                properties=properties,
                years=years,
                max_cycles=max_cycles
            )
            
            # Add optimization results to response
            response_data['optimization'] = {
                'enabled': True,
                'total_cycles': optimization_results['total_cycles'],
                'chart1_data_summary': optimization_results['chart1_data_summary'],
                'final_recommendation': optimization_results['final_recommendation'],
                'cycle_results': [
                    {
                        'cycle': cr['cycle'],
                        'recommended_properties': cr['recommended_properties'],
                        'rationale': cr['rationale'],
                        'key_factors': cr['key_factors'],
                        'risk_assessment': cr['risk_assessment'],
                        'expected_outcomes': cr['expected_outcomes']
                    }
                    for cr in optimization_results['cycle_results']
                ]
            }
            logger.info(f"LLM optimization completed - Recommended properties: {optimization_results['final_recommendation']['recommended_properties']}")
        except Exception as e:
            logger.error(f"Error during LLM optimization: {str(e)}")
            response_data['optimization'] = {
                'enabled': True,
                'error': str(e)
            }
    else:
        logger.info("LLM optimization disabled - returning chart1 data only")
    
    response = {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(response_data, cls=DecimalEncoder)
    }
    
    logger.info(f"Lambda handler completed successfully with statusCode: 200")
    return response


# For local testing
if __name__ == "__main__":
    test_id = "B17153AB-B66E-4085-A4C1-929EC158FC3E"  # Replace with your test ID
    table_name = "BA-PORTAL-BASETABLE"
    
    # Convert Decimal values from DynamoDB to float
    def convert_decimal_to_float(obj):
        if isinstance(obj, Decimal):
            return float(obj)
        elif isinstance(obj, dict):
            return {k: convert_decimal_to_float(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_decimal_to_float(item) for item in obj]
        return obj
    
    # Check if running with optimization
    import sys
    run_optimization = len(sys.argv) > 1 and sys.argv[1] == '--optimize'
    
    try:
        data = get_data_from_dynamodb(table_name, test_id)
        print(f"Retrieved data for ID: {test_id}")
        print(f"Investors: {json.dumps(data['investors'], indent=2, cls=DecimalEncoder)}")
        print(f"Properties: {json.dumps(data['properties'], indent=2, cls=DecimalEncoder)}")
        print(f"Years: {data['investment_years']}")
        
        investors = convert_decimal_to_float(data['investors'])
        properties = convert_decimal_to_float(data['properties'])
        years = int(data['investment_years'])
        
        if run_optimization:
            # Run the LLM optimization (this will print cycle outputs)
            optimization_results = optimize_property_investment(
                investors=investors,
                properties=properties,
                years=years,
                max_cycles=3
            )
            
            # Print final JSON output
            print("\n" + "="*60)
            print("FINAL JSON OUTPUT:")
            print("="*60)
            print(json.dumps({
                'chart1_data_summary': optimization_results['chart1_data_summary'],
                'final_recommendation': optimization_results['final_recommendation'],
                'total_cycles': optimization_results['total_cycles'],
                'cycle_results': [
                    {
                        'cycle': cr['cycle'],
                        'recommended_properties': cr['recommended_properties'],
                        'rationale': cr['rationale'],
                        'key_factors': cr['key_factors'],
                        'risk_assessment': cr['risk_assessment'],
                        'expected_outcomes': cr['expected_outcomes']
                    }
                    for cr in optimization_results['cycle_results']
                ]
            }, indent=2, cls=DecimalEncoder))
        else:
            # Call the function without optimization
            results = borrowing_capacity_forecast_investor_blocks(
                investors=investors,
                properties=properties,
                years=years
            )
            print("\nResults:")
            print(json.dumps(results, indent=2, cls=DecimalEncoder))
            
            print("\n" + "="*60)
            print("To run LLM optimization, run with --optimize flag:")
            print("python main.py --optimize")
            print("="*60)
            
    except Exception as e:
        import traceback
        print(f"Error: {e}")
        traceback.print_exc()