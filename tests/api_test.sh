#!/bin/bash

# Define the API endpoint and base URL
#API='multiply'
#API='send-email'
#API='submit-soa'
#API='ticker_analysis'
#API='sentiment_tracker'
#API='update_leads'
#API='onboard_advisors'
API='get_soi'  # New endpoint for insurance advice
URL='http://localhost:8080'
#URL="https://n54lm5igkl.execute-api.ap-southeast-2.amazonaws.com/dev/"
#URL='https://fintelle.wn.r.appspot.com'
#URL='https://192.168.1.106:8080/'

# Concatenate the variables to create the full URL
FULL_URL="${URL}/${API}"

# Make the POST request with curl
#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"a": "12", "b": "15"}'

#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"TickerSymbol": "GEM", "exchangeName": ".ax", "period": "3mo"}'

#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"TickerSymbol": "ANZ", "exchangeName": ".ax"}'

#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"name": "ANZ", "email": ".ax","message":"Testing"}'

# Uncomment the following line to use a specific URL without concatenation
#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"a": "12", "b": "15"}'
#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"recipient": "dilku@yahoo.com", "subject": "Subject Testing","body":"Testing Body"}'

#curl -X POST \
#  "$FULL_URL" \
#  -H "Content-Type: application/json" \
#  -d '{
##    "fullName": "John Doe",
#    "email": "johndoe@example.com",
#    "phone": "1234567890",
#    "age": 30,
#    "financialGoal": "Medium-term Goals (3-5 years)",
#    "investmentAmount": 50000,
#    "riskTolerance": "Medium",
#    "acknowledgeDisclaimer": true
#  }'

# Test the onboard_advisors endpoint
#curl -X POST \
#  "$FULL_URL" \
#  -H "Content-Type: application/json" \
#  -d '{
#    "name": "Jane Doe",
#    "phone": "0987654321",
#    "email": "janedoe@example.com",
#    "afsl": "123456",
#    "businessName": "Doe Financial Services",
#    "businessAddress": "123 Financial St, Sydney, NSW",
#    "businessURL": "https://doefinancial.com",
#    "agreement1": true,
#    "agreement2": true
#  }'

# Test the get_soi endpoint
curl -X POST \
  "$FULL_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "johndoe@example.com",
    "phone": "1234567890",
    "age": 35,
    "annualIncome": 80000,
    "dependents": "Yes",
    "debts": 200000,
    "survivalMonths": 6,
    "occupation": "Software Engineer",
    "medicalConditions": "No",
    "smokeDrink": "No",
    "insuranceType": "Hybrid",
    "healthCoverage": "Both",
    "monthlyPremium": 200,
    "existingPolicies": "Life Insurance",
    "payoutPreference": "Lump Sum"
  }'