#!/usr/bin/env python3
"""
Test script to verify the fix for the Lambda event parsing issue.
This script tests the exact scenario that was causing the error.
"""

import json
import sys
import os

# Add the current directory to Python path so we can import read_table
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from read_table import parse_lambda_event, lambda_handler

def test_api_gateway_event():
    """Test with API Gateway proxy event format."""
    print("Testing API Gateway proxy event format...")
    
    # Test case 1: Standard JSON body (what should work)
    event1 = {
        'body': json.dumps({
            'table_name': 'BA-PORTAL-BASETABLE',
            'id': 'B57153AB-B66E-4085-A4C1-929EC158FC3E',
            'region': 'ap-southeast-2'
        })
    }
    
    try:
        result1 = parse_lambda_event(event1)
        print("✅ Test 1 passed - Standard JSON body")
        print(f"   Result: {result1}")
    except Exception as e:
        print(f"❌ Test 1 failed - Standard JSON body: {e}")
    
    # Test case 2: URL-encoded form data
    event2 = {
        'body': 'table_name=BA-PORTAL-BASETABLE&id=B57153AB-B66E-4085-A4C1-929EC158FC3E&region=ap-southeast-2'
    }
    
    try:
        result2 = parse_lambda_event(event2)
        print("✅ Test 2 passed - URL-encoded form data")
        print(f"   Result: {result2}")
    except Exception as e:
        print(f"❌ Test 2 failed - URL-encoded form data: {e}")
    
    # Test case 3: Query string parameters
    event3 = {
        'queryStringParameters': {
            'table_name': 'BA-PORTAL-BASETABLE',
            'id': 'B57153AB-B66E-4085-A4C1-929EC158FC3E',
            'region': 'ap-southeast-2'
        }
    }
    
    try:
        result3 = parse_lambda_event(event3)
        print("✅ Test 3 passed - Query string parameters")
        print(f"   Result: {result3}")
    except Exception as e:
        print(f"❌ Test 3 failed - Query string parameters: {e}")
    
    # Test case 4: Mixed body and query parameters
    event4 = {
        'body': json.dumps({'id': 'B57153AB-B66E-4085-A4C1-929EC158FC3E'}),
        'queryStringParameters': {
            'table_name': 'BA-PORTAL-BASETABLE'
        }
    }
    
    try:
        result4 = parse_lambda_event(event4)
        print("✅ Test 4 passed - Mixed body and query parameters")
        print(f"   Result: {result4}")
    except Exception as e:
        print(f"❌ Test 4 failed - Mixed body and query parameters: {e}")
    
    # Test case 5: Case-insensitive parameter names
    event5 = {
        'body': json.dumps({
            'tableName': 'BA-PORTAL-BASETABLE',
            'ID': 'B57153AB-B66E-4085-A4C1-929EC158FC3E'
        })
    }
    
    try:
        result5 = parse_lambda_event(event5)
        print("✅ Test 5 passed - Case-insensitive parameter names")
        print(f"   Result: {result5}")
    except Exception as e:
        print(f"❌ Test 5 failed - Case-insensitive parameter names: {e}")

def test_full_lambda_handler():
    """Test the full lambda handler with a mock event."""
    print("\nTesting full Lambda handler...")
    
    # Create a test event similar to what API Gateway would send
    test_event = {
        'body': json.dumps({
            'table_name': 'BA-PORTAL-BASETABLE',
            'id': 'B57153AB-B66E-4085-A4C1-929EC158FC3E',
            'region': 'ap-southeast-2'
        }),
        'requestContext': {
            'requestId': 'test-request-123'
        }
    }
    
    # Mock context
    class MockContext:
        def __init__(self):
            self.function_name = 'test-function'
            self.memory_limit_in_mb = 128
            self.invoked_function_arn = 'arn:aws:lambda:ap-southeast-2:123456789012:function:test-function'
    
    try:
        response = lambda_handler(test_event, MockContext())
        print("✅ Full Lambda handler test passed")
        print(f"   Status Code: {response['statusCode']}")
        print(f"   Response Body: {response['body'][:100]}...")
    except Exception as e:
        print(f"❌ Full Lambda handler test failed: {e}")
        import traceback
        traceback.print_exc()

def test_edge_cases():
    """Test edge cases that might cause issues."""
    print("\nTesting edge cases...")
    
    # Test case 1: Empty body
    event1 = {'body': ''}
    try:
        result1 = parse_lambda_event(event1)
        print("❌ Test 1 should have failed - Empty body")
    except Exception as e:
        print("✅ Test 1 passed - Empty body correctly rejected")
    
    # Test case 2: Missing required parameters
    event2 = {'body': json.dumps({'table_name': 'BA-PORTAL-BASETABLE'})}
    try:
        result2 = parse_lambda_event(event2)
        print("❌ Test 2 should have failed - Missing ID")
    except Exception as e:
        print("✅ Test 2 passed - Missing ID correctly rejected")
    
    # Test case 3: Invalid JSON
    event3 = {'body': '{invalid json}'}
    try:
        result3 = parse_lambda_event(event3)
        print("❌ Test 3 should have failed - Invalid JSON")
    except Exception as e:
        print("✅ Test 3 passed - Invalid JSON correctly handled")

if __name__ == "__main__":
    print("🧪 Testing Lambda event parsing fixes...")
    print("=" * 50)
    
    test_api_gateway_event()
    test_full_lambda_handler()
    test_edge_cases()
    
    print("\n" + "=" * 50)
    print("🎉 Testing completed!")