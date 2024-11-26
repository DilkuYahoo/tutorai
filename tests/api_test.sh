#!/bin/bash

# Define the API endpoint and base URL
#API='multiply'
#API='ticker_analysis'
API='sentiment_tracker'
#URL='http://localhost:8080'
# Uncomment and set the desired URL
URL='https://fintelle.wn.r.appspot.com'
# URL='https://192.168.1.106:8080/'

# Concatenate the variables to create the full URL
FULL_URL="${URL}/${API}"

# Make the POST request with curl
#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"a": "12", "b": "15"}'

#curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"TickerSymbol": "GEM", "exchangeName": ".ax", "period": "3mo"}'

curl -X POST "$FULL_URL" -H "Content-Type: application/json" -d '{"TickerSymbol": "ANZ", "exchangeName": ".ax"}'

# Uncomment the following line to use a specific URL without concatenation
# curl -X POST "$URL" -H "Content-Type: application/json" -d '{"a": "12", "b": "15"}'
