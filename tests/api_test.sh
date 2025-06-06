#!/bin/bash

# Base URL for the Flask app
BASE_URL="http://localhost:8080"
#BASE_URL="https://n54lm5igkl.execute-api.ap-southeast-2.amazonaws.com/dev/"

# Function to print a test result
print_result() {
    if [ "$1" -eq 0 ]; then
        echo -e "\033[32mPASS\033[0m: $2"
    else
        echo -e "\033[31mFAIL\033[0m: $2"
    fi
}

# Test health check endpoint
echo "Testing health check endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$response" -eq 200 ]; then
    print_result 0 "Health check endpoint"
else
    print_result 1 "Health check endpoint"
fi

# Test send-email endpoint
echo "Testing send-email endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/send-email" \
    -H "Content-Type: application/json" \
    -d '{"recipient": "dilkushan@gmail.com", "subject": "Test Subject", "body": "Test Body"}')
if [ "$response" -eq 200 ]; then
    print_result 0 "send-email endpoint"
else
    print_result 1 "send-email endpoint"
fi

# Enhanced Test for get_retirement_soa endpoint
echo "Testing get_retirement_soa endpoint with retirement scenario..."
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/get_retirement_soa" \
    -H "Content-Type: application/json" \
    -d '{
        "fullName": "John Smith",
        "email": "john.smith@example.com",
        "phone": "0412345678",
        "persona": "Age: 64\nOccupation: Part-time caterer (sole trader)\nLocation: Wollongong, NSW\nMarital Status: Widowed\nDependents: None\nCurrent Super Balance: $320,000\nAssets:\n- Home (owner-occupied, mortgage-free, valued at ~$950,000)\n- Catering equipment and van (~$20,000 total market value)\n- Business income: ~$20,000/year\n- Savings: ~$25,000\nLiabilities: None\nBusiness Structure: Sole trader with ABN\nGoals:\n- Semi-retire at 65 while keeping the business running part-time\n- Maximise Centrelink Age Pension entitlements\n- Maintain a modest lifestyle with occasional travel and community involvement\nConcerns:\n- Unsure how her business and assets affect the pension\n- Doesn'\''t understand how super withdrawals are treated under income test\n- Wants to avoid selling her home or winding up her business\nNeeds:\n- Guidance on using super to supplement income tax-efficiently\n- Structuring the business to minimise impact on Age Pension eligibility\n- Plan for succession or exit of her micro-business"
    }')
if [ "$response" -eq 200 ]; then
    print_result 0 "get_retirement_soa endpoint with retirement scenario"
else
    print_result 1 "get_retirement_soa endpoint with retirement scenario"
fi

# Test get_soi endpoint
echo "Testing get_soi endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/get_soi" \
    -H "Content-Type: application/json" \
    -d '{
        "fullName": "John Doe",
        "email": "john.doe@example.com",
        "phone": "1234567890",
        "age": 30,
        "annualIncome": 60000,
        "dependents": 2,
        "debts": 10000,
        "survivalMonths": 6,
        "occupation": "Engineer",
        "medicalConditions": "None",
        "smokeDrink": "No",
        "insuranceType": "Life",
        "healthCoverage": "Yes",
        "monthlyPremium": 100
    }')
if [ "$response" -eq 200 ]; then
    print_result 0 "get_soi endpoint"
else
    print_result 1 "get_soi endpoint"
fi

# Test update_leads endpoint
echo "Testing update_leads endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/update_leads" \
    -H "Content-Type: application/json" \
    -d '{
        "fullName": "Jane Doe",
        "email": "jane.doe@example.com",
        "phone": "0987654321",
        "age": 25,
        "financialGoal": "Retirement",
        "investmentAmount": 50000,
        "riskTolerance": "high"
    }')
if [ "$response" -eq 200 ]; then
    print_result 0 "update_leads endpoint"
else
    print_result 1 "update_leads endpoint"
fi

# Test onboard_advisors endpoint
echo "Testing onboard_advisors endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/onboard_advisors" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Advisor Name",
        "phone": "1234567890",
        "email": "advisor@example.com",
        "afsl": "123456",
        "businessName": "Advisor Business",
        "businessAddress": "123 Business St",
        "businessURL": "https://advisor.com",
        "agreement1": true,
        "agreement2": true
    }')
if [ "$response" -eq 200 ]; then
    print_result 0 "onboard_advisors endpoint"
else
    print_result 1 "onboard_advisors endpoint"
fi

# Test multiply endpoint
echo "Testing multiply endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/multiply" \
    -H "Content-Type: application/json" \
    -d '{"a": 5, "b": 10}')
if [ "$response" -eq 200 ]; then
    print_result 0 "multiply endpoint"
else
    print_result 1 "multiply endpoint"
fi

echo "All tests completed."