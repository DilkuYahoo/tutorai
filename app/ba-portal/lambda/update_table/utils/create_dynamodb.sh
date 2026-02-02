#!/bin/bash

# Variables
TABLE_NAME="BA-PORTAL-BASETABLE"
REGION="ap-southeast-2"
UUID=$(uuidgen)
CREATION_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "Starting DynamoDB table creation script..."
echo "Table Name: $TABLE_NAME"
echo "Region: $REGION"

# Delete table if it exists
echo "Deleting table $TABLE_NAME if it exists..."
aws dynamodb delete-table --table-name $TABLE_NAME --region $REGION || echo "Table does not exist or deletion failed, continuing..."

# Wait for table to be deleted
echo "Waiting for table deletion to complete..."
aws dynamodb wait table-not-exists --table-name $TABLE_NAME --region $REGION
echo "Table deletion confirmed."

# Create DynamoDB table
echo "Creating DynamoDB table $TABLE_NAME..."
aws dynamodb create-table \
  --table-name $TABLE_NAME \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

if [ $? -eq 0 ]; then
    echo "Table creation initiated successfully."
else
    echo "Table creation failed."
    exit 1
fi

# Wait for table to be active
echo "Waiting for table $TABLE_NAME to be active..."
aws dynamodb wait table-exists --table-name $TABLE_NAME --region $REGION
echo "Table $TABLE_NAME is now active."

# Insert data
echo "Inserting data into table $TABLE_NAME..."
aws dynamodb put-item \
  --table-name $TABLE_NAME \
  --region $REGION \
  --item '{
    "id": {"S": "'"$UUID"'"},
    "adviser_name": {"S": "ba-portal"},
    "creation_date": {"S": "'"$CREATION_DATE"'"},
    "last_updated_date": {"S": "'"$CREATION_DATE"'"},
    "number_of_updates": {"N": "0"},
    "status": {"S": "active"},
    "investors": {
      "L": [
        {
          "M": {
            "name": {"S": "Bob"},
            "base_income": {"N": "120000"},
            "annual_growth_rate": {"N": "0.03"},
            "income_events": {
              "L": [
                {
                  "M": {
                    "year": {"N": "5"},
                    "type": {"S": "increase"},
                    "amount": {"N": "10000"}
                  }
                },
                {
                  "M": {
                    "year": {"N": "10"},
                    "type": {"S": "set"},
                    "amount": {"N": "150000"}
                  }
                }
              ]
            }
          }
        },
        {
          "M": {
            "name": {"S": "Alice"},
            "base_income": {"N": "100000"},
            "annual_growth_rate": {"N": "0.025"},
            "income_events": {"L": []}
          }
        }
      ]
    },
    "properties": {
      "L": [
        {
          "M": {
            "name": {"S": "Property A"},
            "purchase_year": {"N": "1"},
            "loan_amount": {"N": "600000"},
            "annual_principal_change": {"N": "0"},
            "rent": {"N": "30000"},
            "interest_rate": {"N": "0.05"},
            "other_expenses": {"N": "5000"},
            "property_value": {"N": "660000"},
            "initial_value": {"N": "600000"},
            "growth_rate": {"N": "0.03"},
            "investor_splits": {
              "L": [
                {
                  "M": {
                    "name": {"S": "Bob"},
                    "percentage": {"N": "50"}
                  }
                },
                {
                  "M": {
                    "name": {"S": "Alice"},
                    "percentage": {"N": "50"}
                  }
                }
              ]
            }
          }
        },
        {
          "M": {
            "name": {"S": "Property B"},
            "purchase_year": {"N": "3"},
            "loan_amount": {"N": "500000"},
            "annual_principal_change": {"N": "0"},
            "rent": {"N": "25000"},
            "interest_rate": {"N": "0.04"},
            "other_expenses": {"N": "4000"},
            "property_value": {"N": "550000"},
            "initial_value": {"N": "500000"},
            "growth_rate": {"N": "0.03"},
            "investor_splits": {
              "L": [
                {
                  "M": {
                    "name": {"S": "Bob"},
                    "percentage": {"N": "50"}
                  }
                },
                {
                  "M": {
                    "name": {"S": "Alice"},
                    "percentage": {"N": "50"}
                  }
                }
              ]
            }
          }
        }
      ]
    }
  }'

if [ $? -eq 0 ]; then
    echo "Data insertion successful."
else
    echo "Data insertion failed."
    exit 1
fi

echo "Script completed successfully."