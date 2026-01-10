#!/usr/bin/env python3
"""
Test script for the dynamic DynamoDB updater.

This script demonstrates how to use the dynamic_update_script.py to update 
attributes in a DynamoDB table.
"""

import json
import subprocess
import sys
import uuid
from datetime import datetime

def run_update_command(table_name: str, item_id: str, attributes: dict, enable_logging: bool = False, use_transaction: bool = False) -> bool:
    """Run the update command and return success status."""
    try:
        # Convert attributes to JSON string
        attributes_json = json.dumps(attributes)
        
        # Build command
        cmd = [
            sys.executable, 
            "dynamic_update_script.py",
            "--table_name", table_name,
            "--id", item_id,
            "--attributes", attributes_json
        ]
        
        if enable_logging:
            cmd.append("--enable_logging")
        
        if use_transaction:
            cmd.append("--use_transaction")
        
        # Run the command
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=".")
        
        print("Command executed:")
        print(" ".join(cmd))
        print(f"Return code: {result.returncode}")
        print(f"Stdout: {result.stdout}")
        if result.stderr:
            print(f"Stderr: {result.stderr}")
        
        return result.returncode == 0
        
    except Exception as e:
        print(f"Error running update command: {str(e)}")
        return False

def main():
    """Main test function."""
    print("=== Testing Dynamic DynamoDB Updater ===")
    
    # Configuration
    table_name = "BA-PORTAL-BASETABLE"
    
    # Generate a test ID (in production, you'd use an existing ID from your table)
    # test_id = str(uuid.uuid4())
    test_id = "B57153AB-B66E-4085-A4C1-929EC158FC3E"
    
    print(f"Using table: {table_name}")
    print(f"Test item ID: {test_id}")
    
    # Test 1: Basic update without logging
    print("\n=== Test 1: Basic update without logging ===")
    attributes1 = {
        "status": "test_status",
        "adviser_name": "test_adviser"
    }
    
    success1 = run_update_command(table_name, test_id, attributes1)
    print(f"Test 1 result: {'SUCCESS' if success1 else 'FAILED'}")
    
    # Test 2: Update with different attributes
    print("\n=== Test 2: Update with different attributes ===")
    attributes2 = {
        "status": "updated_status",
        "adviser_name": "updated_adviser"
    }
    
    success2 = run_update_command(table_name, test_id, attributes2)
    print(f"Test 2 result: {'SUCCESS' if success2 else 'FAILED'}")
    
    # Test 3: Transactional update
    print("\n=== Test 3: Transactional update ===")
    attributes3 = {
        "status": "transactional_status",
        "adviser_name": "transactional_adviser"
    }
    
    success3 = run_update_command(table_name, test_id, attributes3, use_transaction=True)
    print(f"Test 3 result: {'SUCCESS' if success3 else 'FAILED'}")
    
    # Test 4: Complex nested data update (investors and properties)
    print("\n=== Test 4: Complex nested data update ===")
    attributes4 = {
        "investors": [
            {
                "name": "Bob",
                "base_income": 120000,
                "annual_growth_rate": 3,  # Changed from 0.03 to 3 (integer)
                "income_events": [
                    {"year": 5, "type": "increase", "amount": 10000},
                    {"year": 10, "type": "set", "amount": 150000}
                ]
            },
            {
                "name": "Alice",
                "base_income": 100000,
                "annual_growth_rate": 25,  # Changed from 0.025 to 25 (integer)
                "income_events": []
            }
        ],
        "properties": [
            {
                "name": "Property A",
                "purchase_year": 1,
                "loan_amount": 600000,
                "annual_principal_change": 0,  # Interest-only
                "rent": 30000,
                "interest_rate": 5,  # Changed from 0.05 to 5 (integer)
                "other_expenses": 5000,
                "property_value": 660000,  # loan * 1.1
                "initial_value": 600000,
                "growth_rate": 3,  # Changed from 0.03 to 3 (integer)
                "investor_splits": [{"name": "Bob", "percentage": 50}, {"name": "Alice", "percentage": 50}]
            },
            {
                "name": "Property B",
                "purchase_year": 3,
                "loan_amount": 500000,
                "annual_principal_change": 0,  # Interest-only
                "rent": 25000,
                "interest_rate": 4,  # Changed from 0.04 to 4 (integer)
                "other_expenses": 4000,
                "property_value": 550000,  # loan * 1.1
                "initial_value": 500000,
                "growth_rate": 3,  # Changed from 0.03 to 3 (integer)
                "investor_splits": [{"name": "Bob", "percentage": 50}, {"name": "Alice", "percentage": 50}]
            }
        ]
    }
    
    success4 = run_update_command(table_name, test_id, attributes4)
    print(f"Test 4 result: {'SUCCESS' if success4 else 'FAILED'}")
    
    # Test 5: Error handling test (invalid attributes)
    print("\n=== Test 5: Error handling test ===")
    attributes5 = {
        "id": "should_fail",  # This should fail as 'id' is reserved
        "invalid_field": "value"
    }
    
    success5 = run_update_command(table_name, test_id, attributes5)
    print(f"Test 5 result: {'SUCCESS' if success5 else 'FAILED (expected)'}")
    
    # Summary
    print("\n=== Test Summary ===")
    tests_passed = sum([success1, success2, success3, success4, not success5])  # Test 5 should fail
    total_tests = 5
    
    print(f"Tests passed: {tests_passed}/{total_tests}")
    
    if tests_passed == total_tests:
        print("✅ All tests completed successfully!")
    else:
        print("❌ Some tests failed.")
    
    print("\nNote: Tests 1-4 are expected to fail if the item ID doesn't exist in the table.")
    print("In a real scenario, you would use an existing ID from your DynamoDB table.")
    print("Test 5 is expected to fail due to attempting to update the reserved 'id' field.")
    print("All logging is now console-based (file logging removed for container compatibility).")

if __name__ == "__main__":
    main()