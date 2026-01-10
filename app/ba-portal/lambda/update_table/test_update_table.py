#!/usr/bin/env python3
"""
Test script for the enhanced update_table Lambda function
"""

import json
import sys
import os
from unittest.mock import Mock, patch

# Add the current directory to Python path so we can import the lambda handler
sys.path.insert(0, os.path.dirname(__file__))

from update_table import lambda_handler

def test_enhanced_lambda_handler():
    """Test the enhanced Lambda handler to verify it returns table_name and id"""
    
    # Mock event data
    test_event = {
        'body': json.dumps({
            'table_name': 'test-table',
            'id': 'test-item-123',
            'attributes': {
                'name': 'Test Item',
                'status': 'active'
            },
            'region': 'ap-southeast-2',
            'use_transaction': False
        })
    }
    
    print("Testing enhanced update_table Lambda handler...")
    
    # Mock the DynamoDB operations to avoid actual AWS calls
    with patch('update_table.DynamoDBUpdater') as mock_updater:
        # Setup mock behavior
        mock_instance = mock_updater.return_value
        mock_instance.check_item_exists.return_value = True
        mock_instance.update_item.return_value = {
            'id': 'test-item-123',
            'name': 'Test Item',
            'status': 'active',
            'number_of_updates': 1,
            'last_updated_date': '2023-01-01T00:00:00'
        }
        
        # Call the Lambda handler
        response = lambda_handler(test_event, None)
        
        # Parse and validate the response
        print(f"Status Code: {response['statusCode']}")
        
        if response['statusCode'] == 200:
            body = json.loads(response['body'])
            print(f"Message: {body['message']}")
            print(f"Table Name: {body.get('table_name', 'NOT FOUND')}")
            print(f"Item ID: {body.get('id', 'NOT FOUND')}")
            
            # Verify the response contains both table_name and id
            if 'table_name' in body and 'id' in body:
                if body['table_name'] == 'test-table' and body['id'] == 'test-item-123':
                    print("✅ Enhanced Lambda handler test PASSED - Both table_name and id are returned correctly")
                    return True
                else:
                    print("❌ Enhanced Lambda handler test FAILED - Values don't match expected")
                    return False
            else:
                print("❌ Enhanced Lambda handler test FAILED - Missing table_name or id in response")
                return False
        else:
            error_body = json.loads(response['body'])
            print(f"❌ Enhanced Lambda handler test FAILED: {error_body.get('error', 'Unknown error')}")
            return False

def test_error_cases():
    """Test error cases to ensure they still work correctly"""
    
    print("\nTesting error cases...")
    
    # Test missing table_name
    error_event = {
        'body': json.dumps({
            'id': 'test-item-123',
            'attributes': {'name': 'Test'}
        })
    }
    
    response = lambda_handler(error_event, None)
    
    if response['statusCode'] == 400:
        error_body = json.loads(response['body'])
        if 'Missing required parameter: table_name' in error_body['error']:
            print("✅ Error case test PASSED - Missing table_name handled correctly")
            return True
        else:
            print("❌ Error case test FAILED - Wrong error message")
            return False
    else:
        print("❌ Error case test FAILED - Expected 400 status code")
        return False

if __name__ == "__main__":
    success1 = test_enhanced_lambda_handler()
    success2 = test_error_cases()
    
    if success1 and success2:
        print("\n🎉 All tests PASSED - Enhanced update_table Lambda function is working correctly!")
        sys.exit(0)
    else:
        print("\n💥 Some tests FAILED - Please check the implementation")
        sys.exit(1)