#!/usr/bin/env python3
"""
Test script for BA Agent Lambda Function deployment validation.

This script tests the /ba-agent endpoint to validate:
1. CORS headers are properly set
2. Lambda integration is working
3. API returns expected responses

Usage:
    python test_ba_agent_api.py
"""

import requests
import json
import sys
import os

# Configuration
API_ID = "gwhfr6wpc8"
REGION = "ap-southeast-2"
STAGE = "prod"
ENDPOINT_PATH = "/ba-agent"

# Build the API URL
API_URL = f"https://{API_ID}.execute-api.{REGION}.amazonaws.com/{STAGE}{ENDPOINT_PATH}"

# Test data
TEST_ID = "B57153AB-B66E-4085-A4C1-929EC158FC3E"


def test_cors_preflight():
    """Test CORS preflight (OPTIONS) request."""
    print("\n" + "=" * 60)
    print("TEST 1: CORS Preflight (OPTIONS)")
    print("=" * 60)
    
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type"
    }
    
    try:
        response = requests.options(API_URL, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Headers:")
        for key, value in response.headers.items():
            if "access-control" in key.lower():
                print(f"  {key}: {value}")
        
        # Check required CORS headers
        cors_checks = {
            "Access-Control-Allow-Origin": response.headers.get("Access-Control-Allow-Origin"),
            "Access-Control-Allow-Methods": response.headers.get("Access-Control-Allow-Methods"),
            "Access-Control-Allow-Headers": response.headers.get("Access-Control-Allow-Headers")
        }
        
        print("\nCORS Validation:")
        all_passed = True
        for header, value in cors_checks.items():
            status = "✓ PASS" if value else "✗ FAIL"
            print(f"  {status} - {header}: {value}")
            if not value:
                all_passed = False
        
        if all_passed and response.status_code == 200:
            print("\n✓ CORS Preflight Test: PASSED")
            return True
        else:
            print("\n✗ CORS Preflight Test: FAILED")
            return False
            
    except requests.RequestException as e:
        print(f"\n✗ CORS Preflight Test: FAILED - {e}")
        return False


def test_add_property_action():
    """Test the 'add' property action."""
    print("\n" + "=" * 60)
    print("TEST 2: Add Property Action (POST)")
    print("=" * 60)
    
    payload = {
        "table_name": "BA-PORTAL-BASETABLE",
        "id": TEST_ID,
        "property_action": "add",
        "region": REGION
    }
    
    headers = {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
    }
    
    try:
        print(f"Request URL: {API_URL}")
        print(f"Request Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(API_URL, json=payload, headers=headers, timeout=60)
        
        print(f"\nStatus Code: {response.status_code}")
        print(f"Response Headers:")
        for key, value in response.headers.items():
            if "access-control" in key.lower():
                print(f"  {key}: {value}")
        
        # Check CORS headers in response
        cors_origin = response.headers.get("Access-Control-Allow-Origin")
        print(f"\nCORS Origin: {cors_origin}")
        
        # Parse response body
        try:
            body = response.json()
            print(f"\nResponse Body:")
            print(json.dumps(body, indent=2))
            
            # Validate response structure
            if response.status_code == 200:
                if body.get("status") == "success":
                    if body.get("action") == "add":
                        if "property" in body:
                            print("\n✓ Add Property Test: PASSED")
                            return True
                        else:
                            print("\n✗ Add Property Test: FAILED - Missing 'property' in response")
                            return False
                    else:
                        print(f"\n✗ Add Property Test: FAILED - Wrong action: {body.get('action')}")
                        return False
                else:
                    print(f"\n✗ Add Property Test: FAILED - Status: {body.get('status')}")
                    print(f"  Message: {body.get('message', 'No message')}")
                    return False
            else:
                print(f"\n✗ Add Property Test: FAILED - HTTP {response.status_code}")
                print(f"  Error: {body.get('message', 'Unknown error')}")
                return False
                
        except json.JSONDecodeError:
            print(f"\n✗ Add Property Test: FAILED - Invalid JSON response")
            print(f"  Raw response: {response.text[:500]}")
            return False
            
    except requests.RequestException as e:
        print(f"\n✗ Add Property Test: FAILED - {e}")
        return False


def test_optimize_property_action():
    """Test the 'optimize' property action."""
    print("\n" + "=" * 60)
    print("TEST 3: Optimize Property Action (POST)")
    print("=" * 60)
    
    payload = {
        "table_name": "BA-PORTAL-BASETABLE",
        "id": TEST_ID,
        "property_action": "optimize",
        "region": REGION
    }
    
    headers = {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
    }
    
    try:
        print(f"Request URL: {API_URL}")
        print(f"Request Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(API_URL, json=payload, headers=headers, timeout=60)
        
        print(f"\nStatus Code: {response.status_code}")
        
        # Parse response body
        try:
            body = response.json()
            print(f"\nResponse Body:")
            print(json.dumps(body, indent=2))
            
            # Validate response structure
            if response.status_code == 200:
                if body.get("status") == "success":
                    if body.get("action") == "optimize":
                        if "properties" in body and "analysis" in body:
                            print("\n✓ Optimize Property Test: PASSED")
                            return True
                        else:
                            print("\n✗ Optimize Property Test: FAILED - Missing 'properties' or 'analysis'")
                            return False
                    else:
                        print(f"\n✗ Optimize Property Test: FAILED - Wrong action: {body.get('action')}")
                        return False
                else:
                    print(f"\n✗ Optimize Property Test: FAILED - Status: {body.get('status')}")
                    return False
            else:
                print(f"\n✗ Optimize Property Test: FAILED - HTTP {response.status_code}")
                return False
                
        except json.JSONDecodeError:
            print(f"\n✗ Optimize Property Test: FAILED - Invalid JSON response")
            return False
            
    except requests.RequestException as e:
        print(f"\n✗ Optimize Property Test: FAILED - {e}")
        return False


def test_missing_id_validation():
    """Test validation for missing required parameter."""
    print("\n" + "=" * 60)
    print("TEST 4: Missing ID Validation")
    print("=" * 60)
    
    payload = {
        "table_name": "BA-PORTAL-BASETABLE",
        "property_action": "add",
        "region": REGION
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        body = response.json()
        print(f"Response Body:")
        print(json.dumps(body, indent=2))
        
        if response.status_code == 400:
            if "id" in body.get("message", "").lower():
                print("\n✓ Missing ID Validation Test: PASSED")
                return True
            else:
                print("\n✗ Missing ID Validation Test: FAILED - Wrong error message")
                return False
        else:
            print(f"\n✗ Missing ID Validation Test: FAILED - Expected 400, got {response.status_code}")
            return False
            
    except requests.RequestException as e:
        print(f"\n✗ Missing ID Validation Test: FAILED - {e}")
        return False


def test_invalid_action_validation():
    """Test validation for invalid property_action."""
    print("\n" + "=" * 60)
    print("TEST 5: Invalid Action Validation")
    print("=" * 60)
    
    payload = {
        "table_name": "BA-PORTAL-BASETABLE",
        "id": TEST_ID,
        "property_action": "invalid_action",
        "region": REGION
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        body = response.json()
        print(f"Response Body:")
        print(json.dumps(body, indent=2))
        
        if response.status_code == 400:
            if "property_action" in body.get("message", "").lower():
                print("\n✓ Invalid Action Validation Test: PASSED")
                return True
            else:
                print("\n✗ Invalid Action Validation Test: FAILED - Wrong error message")
                return False
        else:
            print(f"\n✗ Invalid Action Validation Test: FAILED - Expected 400, got {response.status_code}")
            return False
            
    except requests.RequestException as e:
        print(f"\n✗ Invalid Action Validation Test: FAILED - {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("BA AGENT LAMBDA DEPLOYMENT VALIDATION TESTS")
    print("=" * 60)
    print(f"\nAPI URL: {API_URL}")
    print(f"Region: {REGION}")
    print(f"Stage: {STAGE}")
    
    results = []
    
    # Run all tests
    results.append(("CORS Preflight", test_cors_preflight()))
    results.append(("Add Property", test_add_property_action()))
    results.append(("Optimize Property", test_optimize_property_action()))
    results.append(("Missing ID Validation", test_missing_id_validation()))
    results.append(("Invalid Action Validation", test_invalid_action_validation()))
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status} - {test_name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print("\n" + "-" * 60)
    print(f"Total: {passed + failed} | Passed: {passed} | Failed: {failed}")
    print("=" * 60)
    
    if failed == 0:
        print("\n✓ ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n✗ {failed} TEST(S) FAILED!")
        return 1


if __name__ == "__main__":
    sys.exit(main())
