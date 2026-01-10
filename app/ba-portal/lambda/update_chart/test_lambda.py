#!/usr/bin/env python3
"""
Test script for the Lambda handler function
"""

import json
import sys
import os

# Add the current directory to Python path so we can import the lambda handler
sys.path.insert(0, os.path.dirname(__file__))

from lambda_handler import lambda_handler

def test_lambda_handler():
    """Test the Lambda handler with sample data"""
    
    # Sample test data
    test_event = {
        'body': {
            'investors': [
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
            ],
            'properties': [
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
            ],
            'years': 5,  # Test with 5 years for faster execution
            'output_file': 'test_chart_data.json'
        }
    }
    
    print("Testing Lambda handler...")
    
    # Call the Lambda handler
    response = lambda_handler(test_event, None)
    
    # Parse and display the response
    print(f"Status Code: {response['statusCode']}")
    
    if response['statusCode'] == 200:
        body = json.loads(response['body'])
        print(f"Message: {body['message']}")
        print(f"Output file: {body['output_file']}")
        
        # Check if results contain expected data
        if 'results' in body:
            results = body['results']
            print(f"Number of years forecasted: {len(results['yearly_forecast'])}")
            
            # Show first year results
            if results['yearly_forecast']:
                first_year = results['yearly_forecast'][0]
                print(f"First year combined income: ${first_year['combined_income']}")
                print(f"First year total debt: ${first_year['total_debt']}")
        
        print("✅ Lambda handler test PASSED")
        return True
    else:
        error_body = json.loads(response['body'])
        print(f"❌ Lambda handler test FAILED: {error_body['error']}")
        return False

if __name__ == "__main__":
    success = test_lambda_handler()
    sys.exit(0 if success else 1)