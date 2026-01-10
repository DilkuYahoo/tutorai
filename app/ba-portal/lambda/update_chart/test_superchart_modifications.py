#!/usr/bin/env python3
"""
Test script for the modified superchart1.py functionality
"""

import json
import sys
import os

# Add the current directory to Python path so we can import the functions
sys.path.insert(0, os.path.dirname(__file__))

from libs.superchart1 import borrowing_capacity_forecast_investor_blocks

def test_structured_response():
    """Test that the function returns structured response instead of writing to file"""
    
    # Sample test data
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
    
    print("Testing structured response (Lambda mode)...")
    
    # Test 1: Call without output_file (Lambda mode)
    result = borrowing_capacity_forecast_investor_blocks(
        investors=investors,
        properties=properties,
        years=5,  # Test with 5 years for faster execution
        output_file=None  # This should return structured data
    )
    
    # Verify the response structure
    expected_keys = ['status', 'message', 'data', 'metadata']
    missing_keys = [key for key in expected_keys if key not in result]
    
    if missing_keys:
        print(f"❌ Structured response test FAILED - Missing keys: {missing_keys}")
        return False
    
    if result['status'] != 'success':
        print(f"❌ Structured response test FAILED - Expected status 'success', got '{result['status']}'")
        return False
    
    if 'yearly_forecast' not in result['data']:
        print("❌ Structured response test FAILED - Missing yearly_forecast in data")
        return False
    
    print(f"✅ Structured response test PASSED")
    print(f"   - Status: {result['status']}")
    print(f"   - Message: {result['message']}")
    print(f"   - Years forecasted: {len(result['data']['yearly_forecast'])}")
    print(f"   - Investors: {result['metadata']['investors']}")
    print(f"   - Properties: {result['metadata']['properties']}")
    
    return True

def test_backward_compatibility():
    """Test that the function still works with output_file parameter (backward compatibility)"""
    
    # Sample test data (simplified for speed)
    investors = [
        {
            "name": "Test",
            "base_income": 100000,
            "annual_growth_rate": 0.02,
            "income_events": []
        }
    ]
    
    properties = [
        {
            "name": "Test Property",
            "purchase_year": 1,
            "loan_amount": 500000,
            "annual_principal_change": 0,
            "rent": 25000,
            "interest_rate": 0.04,
            "other_expenses": 4000,
            "property_value": 550000,
            "initial_value": 500000,
            "growth_rate": 0.02,
            "investor_splits": [{"name": "Test", "percentage": 100}]
        }
    ]
    
    print("\nTesting backward compatibility (file writing mode)...")
    
    # Test 2: Call with output_file (backward compatibility mode)
    result = borrowing_capacity_forecast_investor_blocks(
        investors=investors,
        properties=properties,
        years=3,
        output_file='test_backward_compat.json'  # This should write to file AND return structured data
    )
    
    # Verify the response structure is still maintained
    if 'status' not in result or 'data' not in result:
        print("❌ Backward compatibility test FAILED - Response structure not maintained")
        return False
    
    # Check if file was created
    import os
    if os.path.exists('test_backward_compat.json'):
        print("✅ Backward compatibility test PASSED")
        print("   - File created successfully")
        print("   - Structured response also returned")
        
        # Clean up test file
        os.remove('test_backward_compat.json')
        return True
    else:
        print("❌ Backward compatibility test FAILED - File was not created")
        return False

def test_lambda_handler_integration():
    """Test the integration with the updated lambda_handler.py"""
    
    print("\nTesting Lambda handler integration...")
    
    from lambda_handler import lambda_handler
    
    # Create test event
    test_event = {
        'body': {
            'investors': [
                {
                    "name": "Bob",
                    "base_income": 120000,
                    "annual_growth_rate": 0.03,
                    "income_events": []
                }
            ],
            'properties': [
                {
                    "name": "Property A",
                    "purchase_year": 1,
                    "loan_amount": 500000,
                    "annual_principal_change": 0,
                    "rent": 25000,
                    "interest_rate": 0.04,
                    "other_expenses": 4000,
                    "property_value": 550000,
                    "initial_value": 500000,
                    "growth_rate": 0.02,
                    "investor_splits": [{"name": "Bob", "percentage": 100}]
                }
            ],
            'years': 3
        }
    }
    
    # Call the Lambda handler
    response = lambda_handler(test_event, None)
    
    # Verify the response
    if response['statusCode'] != 200:
        print(f"❌ Lambda handler integration test FAILED - Status code: {response['statusCode']}")
        return False
    
    body = json.loads(response['body'])
    
    # Check for expected fields in the new format
    expected_fields = ['message', 'status', 'metadata', 'chart_data', 'investors', 'properties', 'years_forecasted']
    missing_fields = [field for field in expected_fields if field not in body]
    
    if missing_fields:
        print(f"❌ Lambda handler integration test FAILED - Missing fields: {missing_fields}")
        return False
    
    print("✅ Lambda handler integration test PASSED")
    print(f"   - Status code: {response['statusCode']}")
    print(f"   - Message: {body['message']}")
    print(f"   - Years forecasted: {body['years_forecasted']}")
    print(f"   - Investors: {body['investors']}")
    print(f"   - Properties: {body['properties']}")
    
    return True

if __name__ == "__main__":
    print("Testing modified superchart1.py functionality...\n")
    
    test1 = test_structured_response()
    test2 = test_backward_compatibility()
    test3 = test_lambda_handler_integration()
    
    if test1 and test2 and test3:
        print("\n🎉 All tests PASSED - Modified superchart1.py is working correctly!")
        print("   - Returns structured response for Lambda compatibility")
        print("   - Maintains backward compatibility with file writing")
        print("   - Integrates properly with updated lambda_handler.py")
        sys.exit(0)
    else:
        print("\n💥 Some tests FAILED - Please check the implementation")
        sys.exit(1)