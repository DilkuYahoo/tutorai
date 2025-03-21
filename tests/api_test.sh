#!/bin/bash

# Define the API endpoint and base URL
#API='multiply'
#API='send-email'
#API='submit-soa'
#API='ticker_analysis'
#API='sentiment_tracker'
#API='update_leads'
API='get_retirement_soa'
#API='onboard_advisors'
#API='get_soi'  # New endpoint for insurance advice
#URL='http://localhost:8080'
URL="https://n54lm5igkl.execute-api.ap-southeast-2.amazonaws.com/dev/"
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


#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"fullName": "John Doe", "email": "johndoe@example.com", "phone": "1234567890", "age": 30, "financialGoal": "Medium-term Goals (3-5 years)", "investmentAmount": 50000, "riskTolerance": "Medium", "acknowledgeDisclaimer": true}'

#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"current_age":55,"retirement_age":65,"comfortable_retirement_lifestyle":"Travel and comfortable housing","retirement_income_goal":60000,"current_superannuation_balance":300000,"superannuation_investment":"Balanced","additional_savings":150000,"voluntary_super_contributions":true,"other_sources_of_income":"Part-time job","monthly_living_expenses":4500,"major_expenses_retirement":[ "Travel", "Home renovations" ],"buffer_for_unexpected_expenses":true,"preferred_retirement_income_type":"Account-Based Pension","income_sources":[ "Super Pension", "Rental Income" ],"risk_tolerance":"Moderate","growth_or_stability":"Growth","conservative_or_growth_approach":"Growth","ongoing_financial_advice":true,"review_frequency":"Semiannually","aged_care_planning":true,"eligibility_age_pension":false,"awareness_tax_implications":true,"minimize_tax":true,"valid_will_estate_plan":true,"beneficiaries_superannuation":true,"existing_insurance_policies":true,"concerns_aged_care_medical_expenses":true,"risk_tolerance_investments":"Moderate"}'
curl -X POST "$FULL_URL" -H "Content-Type: application/json" \
-d '{
    "name": "John Doe",
    "contact_number": "1234567890",
    "email_address": "john.doe@example.com",
    "current_age": 60,
    "retirement_age": 65,
    "comfortable_retirement_lifestyle": "Travel and comfortable housing",
    "retirement_income_goal": 40000,
    "current_superannuation_balance": 300000,
    "superannuation_investment": "Balanced",
    "additional_savings": 150000,
    "voluntary_super_contributions": true,
    "other_sources_of_income": "Part-time job",
    "monthly_living_expenses": 3500,
    "major_expenses_retirement": ["Travel", "Home renovations"],
    "buffer_for_unexpected_expenses": true,
    "preferred_retirement_income_type": "Account-Based Pension",
    "income_sources": ["Super Pension", "Rental Income"],
    "risk_tolerance": "Moderate",
    "growth_or_stability": "Growth",
    "conservative_or_growth_approach": "Growth",
    "ongoing_financial_advice": true,
    "review_frequency": "Semiannually",
    "aged_care_planning": true,
    "eligibility_age_pension": false,
    "awareness_tax_implications": true,
    "minimize_tax": true,
    "valid_will_estate_plan": true,
    "beneficiaries_superannuation": true,
    "existing_insurance_policies": true,
    "concerns_aged_care_medical_expenses": true,
    "risk_tolerance_investments": "Moderate"
}'

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
#curl -X POST \
#  "$FULL_URL" \
#  -H "Content-Type: application/json" \
#  -d '{
#    "fullName": "John Doe",
#    "email": "johndoe@example.com",
#    "phone": "1234567890",
#    "age": 35,
#    "annualIncome": 80000,
#    "dependents": "Yes",
#    "debts": 200000,
#    "survivalMonths": 6,
#    "occupation": "Software Engineer",
#    "medicalConditions": "No",
#    "smokeDrink": "No",
#    "insuranceType": "Hybrid",
#    "healthCoverage": "Both",
#    "monthlyPremium": 200,
#    "existingPolicies": "Life Insurance",
#    "payoutPreference": "Lump Sum"
#  }'