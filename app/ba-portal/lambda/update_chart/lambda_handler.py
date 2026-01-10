# Lambda function for updating borrowing capacity chart
# This script provides a proper Lambda handler for the borrowing capacity forecast functionality

from libs.superchart1 import borrowing_capacity_forecast_investor_blocks
import json
import os

def lambda_handler(event, context):
    """
    AWS Lambda handler function for borrowing capacity forecast.
    
    Args:
        event: Lambda event object containing input data
        context: Lambda context object
        
    Returns:
        dict: Response containing status and result data
    """
    try:
        # Parse input from Lambda event
        # Expected event structure:
        # {
        #     "investors": [...],
        #     "properties": [...],
        #     "years": 30,
        #     "output_file": "chart_data.json"
        # }
        
        # Get input data from event
        input_data = event.get('body', {})
        
        # If event body is a string (API Gateway proxy integration), parse it
        if isinstance(input_data, str):
            input_data = json.loads(input_data)
        
        # Extract parameters
        investors = input_data.get('investors', [])
        properties = input_data.get('properties', [])
        years = input_data.get('years', 30)
        output_file = input_data.get('output_file', 'chart_data.json')
        
        # Validate required parameters
        if not investors or not properties:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required parameters: investors and properties are required'
                })
            }
        
        # Call the borrowing capacity forecast function
        # Note: output_file is now optional and defaults to None for Lambda compatibility
        chart_response = borrowing_capacity_forecast_investor_blocks(
            investors=investors,
            properties=properties,
            years=years,
            output_file=None  # Don't write to file in Lambda environment
        )
        
        # Return successful response with structured chart data
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Borrowing capacity forecast completed successfully',
                'status': chart_response['status'],
                'metadata': chart_response['metadata'],
                'chart_data': chart_response['data'],
                'investors': chart_response['metadata']['investors'],
                'properties': chart_response['metadata']['properties'],
                'years_forecasted': len(chart_response['data']['yearly_forecast'])
            })
        }
        
    except Exception as e:
        # Return error response
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Error processing borrowing capacity forecast: {str(e)}'
            })
        }

def main():
    """
    Local testing function that mimics the original script behavior
    """
    # Sample data for testing
    investors = [
        {
            "name": "Bob",
            "base_income": 120000,
            "annual_growth_rate": 0.03,
            "income_events": [
                {"year": 5, "type": "increase", "amount": 10000},
                {"year": 10, "type": "set", "amount": 150000}
            ]
        },
        {
            "name": "Alice",
            "base_income": 100000,
            "annual_growth_rate": 0.025,
            "income_events": []
        }
    ]
    
    properties = [
        {
            "name": "Property A",
            "purchase_year": 1,
            "loan_amount": 600000,
            "annual_principal_change": 0,  # Interest-only
            "rent": 30000,
            "interest_rate": 0.05,
            "other_expenses": 5000,
            "property_value": 660000,  # loan * 1.1
            "initial_value": 600000,
            "growth_rate": 0.03,
            "investor_splits": [{"name": "Bob", "percentage": 50}, {"name": "Alice", "percentage": 50}]
        },
        {
            "name": "Property B",
            "purchase_year": 3,
            "loan_amount": 500000,
            "annual_principal_change":  0,  # Interest-only
            "rent": 25000,
            "interest_rate": 0.04,
            "other_expenses": 4000,
            "property_value": 550000,  # loan * 1.1
            "initial_value": 500000,
            "growth_rate": 0.03,
            "investor_splits": [{"name": "Bob", "percentage": 50}, {"name": "Alice", "percentage": 50}]
        }
    ]
    
    # Create a mock Lambda event for testing
    test_event = {
        'body': {
            'investors': investors,
            'properties': properties,
            'years': 30,
            'output_file': 'chart_data.json'
        }
    }
    
    # Call the Lambda handler
    response = lambda_handler(test_event, None)
    print("Lambda function response:")
    print(json.dumps(response, indent=2))
    
    # Also test the direct function call for backward compatibility
    print("\nTesting direct function call (backward compatibility):")
    direct_results = borrowing_capacity_forecast_investor_blocks(
        investors=investors,
        properties=properties,
        years=30,
        output_file='test_chart_data.json'  # Test file writing mode
    )
    print(f"Direct call status: {direct_results['status']}")
    print(f"Number of years forecasted: {len(direct_results['data']['yearly_forecast'])}")
    
    return response

if __name__ == "__main__":
    # Run local test
    main()