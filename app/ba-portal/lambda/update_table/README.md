# BA Portal Update Table Lambda Function

A serverless AWS Lambda function for dynamically updating DynamoDB table attributes with advanced features including automatic chart1 calculation, transactional integrity, and comprehensive error handling.

## Overview

This Lambda function provides a robust API for updating attributes in a DynamoDB table. It features automatic calculation of borrowing capacity forecasts (chart1) when investor and property data are provided, supports both regular and transactional updates, and includes comprehensive error handling and logging.

## Features

- **Dynamic Attribute Updates**: Update any combination of DynamoDB item attributes
- **Automatic Chart1 Calculation**: Calculates borrowing capacity forecasts using the superchart1 library when investors and properties are provided
- **Transactional Integrity**: Optional DynamoDB transactions for atomic operations
- **Comprehensive Error Handling**: Detailed error responses with proper HTTP status codes
- **API Gateway Integration**: Designed for REST API integration with proper response formatting
- **Flexible Deployment**: Multiple deployment options including full deployment and code-only updates
- **Input Validation**: Thorough validation of all input parameters
- **Audit Trail**: Automatic tracking of update counts and timestamps

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │────│   Lambda Func   │────│   DynamoDB      │
│                 │    │  (Python 3.13)  │    │   Table         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  SuperChart1    │
                       │  Library        │
                       └─────────────────┘
```

## Project Structure

```
update_table/
├── README.md                           # This file
├── DYNAMIC_UPDATER_LAMBDA_README.md    # Legacy documentation
├── update_table.py                     # Main Lambda function handler
├── deploy_lambda.py                    # Full Lambda deployment script
├── deploy_lamdba_code_only.py          # Code-only deployment script
├── deploy.config                       # Deployment configuration
├── requirements.txt                    # Python dependencies
├── test_update_table.py                # Unit tests
├── api_gateway_test_payload.json       # API Gateway test payload
├── sample_lambda_test_payload.json     # Sample test payload
├── libs/
│   └── superchart1.py                  # Chart calculation library
└── main/
    ├── create_dynamodb.sh              # DynamoDB table creation script
    ├── dynamic_update_script.py        # Legacy update script
    ├── test_chart.py                   # Chart testing script
    ├── test_dynamic_update.py          # Dynamic update tests
    ├── DYNAMIC_UPDATER_README.md       # Legacy documentation
    └── libs/
        └── superchart1.py              # Chart library (duplicate)
```

## Deployment

### Prerequisites

- AWS CLI configured with appropriate permissions
- Python 3.13+
- AWS Lambda execution role with DynamoDB permissions
- API Gateway (for HTTP access)

### Configuration

The deployment is configured via `deploy.config`:

```ini
[DEFAULT]
function_name = ba-portal-update-table-lambda-function
region = ap-southeast-2
runtime = python3.13
handler = update_table.lambda_handler
memory = 128
timeout = 10
role_name = ba-portal-update-table-lambda-role
s3_bucket = ba-portal-lambda-bucket
script_path = update_table.py
requirements_file = requirements.txt
```

### Deployment Options

#### 1. Full Deployment (Creates/Updates Function)

```bash
python deploy_lambda.py
```

This script:
- Creates IAM role with DynamoDB permissions
- Creates deployment package with all dependencies
- Deploys or updates the Lambda function
- Supports optional destruction of existing function

#### 2. Code-Only Deployment (Updates Existing Function)

```bash
python deploy_lamdba_code_only.py deploy.config
```

This script:
- Updates only the code of an existing Lambda function
- Preserves function configuration
- Includes libs directory in deployment package
- Requires the function to already exist

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TABLE_NAME` | DynamoDB table name | N/A | Yes |
| `LOG_LEVEL` | Logging verbosity | INFO | No |
| `ENABLE_AUDIT_LOG` | Enable audit logging | false | No |

## API Usage

### Request Format

**HTTP Method**: `POST`

**Content-Type**: `application/json`

**Body**:
```json
{
  "table_name": "BA-PORTAL-BASETABLE",
  "id": "item-uuid-here",
  "attributes": {
    "status": "active",
    "adviser_name": "John Doe",
    "investors": [...],
    "properties": [...]
  },
  "region": "ap-southeast-2",
  "use_transaction": false
}
```

### Response Format

**Success (200)**:
```json
{
  "status": "success",
  "message": "Update successful",
  "item_id": "item-uuid-here",
  "updated_attributes": ["status", "adviser_name"],
  "result": {
    "id": "item-uuid-here",
    "status": "active",
    "adviser_name": "John Doe",
    "chart1": {...},
    "number_of_updates": 1,
    "last_updated_date": "2024-01-25T21:27:12.990Z"
  }
}
```

**Error (400/404/500)**:
```json
{
  "status": "error",
  "message": "Error description"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `table_name` | string | Yes | DynamoDB table name |
| `id` | string | Yes | Item ID to update |
| `attributes` | object | Yes | Key-value pairs to update |
| `region` | string | No | AWS region (default: ap-southeast-2) |
| `use_transaction` | boolean | No | Use DynamoDB transaction (default: false) |

## Chart1 Calculation

When `investors` and `properties` arrays are provided in the attributes, the function automatically calculates a borrowing capacity forecast using the superchart1 library. This generates a 30-year projection of income, borrowing capacity, debt, and cashflow based on investor and property data.

### Investor Attributes

Each investor object must include:

| Attribute | Type | Required | Description | Calculation Involvement |
|-----------|------|----------|-------------|-------------------------|
| `name` | string | Yes | Unique investor identifier | Used as key for tracking incomes, debts, and borrowing capacities |
| `base_income` | float | Yes | Starting annual income | Initial income value, compounded annually |
| `annual_growth_rate` | float | Yes | Annual income growth rate (decimal) | Applied to income each year after year 1 (e.g., 0.05 = 5% growth) |
| `essential_expenditure` | float | Yes | Annual essential living expenses | Deducted from net income each year, grows with CPI (3% annually) |
| `nonessential_expenditure` | float | Yes | Annual nonessential living expenses | Deducted from net income each year, grows with CPI (3% annually) |
| `income_events` | array | No | List of income changes | Applied at specified years; each event has `year`, `type` ("increase" or "set"), and `amount` |

### Property Attributes

Each property object must include:

| Attribute | Type | Required | Description | Calculation Involvement |
|-----------|------|----------|-------------|-------------------------|
| `name` | string | Yes | Unique property identifier | Used as key for tracking balances, values, and LVRs |
| `purchase_year` | int | Yes | Year property was acquired | Determines when property enters calculations |
| `loan_amount` | float | Yes | Initial loan principal | Starting balance for debt calculations |
| `annual_principal_change` | float | Yes | Annual change to loan balance | Added to balance each year (negative for repayments) |
| `rent` | float | Yes | Annual rental income | Added as income to proportional investors; summed for total cashflow |
| `interest_rate` | float | Yes | Annual loan interest rate (decimal) | Multiplied by balance to calculate annual interest cost |
| `other_expenses` | float | Yes | Annual expenses excluding interest | Subtracted proportionally from investor incomes |
| `initial_value` | float | No | Starting property value (defaults to `loan_amount`) | Base value for growth calculations |
| `growth_rate` | float | Yes | Annual property value growth rate (decimal) | Applied to value each year for appreciation |
| `investor_splits` | array | Yes | Ownership percentages | List of objects with `name` (investor) and `percentage` (decimal); used to allocate costs/incomes |

**Note**: The `property_value` attribute is listed in documentation but not used in calculations. Use `initial_value` instead.

### Calculation Details

The forecast calculates the following for each year:

1. **Investor Incomes**: Start with `base_income`, apply any `income_events` for the year, then apply `annual_growth_rate` (after year 1).

2. **Property Balances**: Initialize with `loan_amount` at `purchase_year`, then add `annual_principal_change` each subsequent year.

3. **Interest Costs**: Calculated as `balance * interest_rate` for each property, allocated proportionally to investors via `investor_splits`.

4. **Investor Net Incomes**: `gross_income + proportional_rent - proportional_interest - proportional_other_expenses`.

5. **Borrowing Capacity**: `net_income * 6 - current_debt` (6x multiple commonly used for lending).

6. **Property Cashflow**: `total_rent - total_interest - total_other_expenses`.
7. **Household Surplus**: `total_net_incomes - total_essential_expenses - total_nonessential_expenses + property_cashflow`.

7. **Property LVRs**: `loan_balance / property_value * 100` (Loan-to-Value Ratio).

8. **Property Values**: Start with `initial_value`, grow annually by `(1 + growth_rate)`.

### Output Structure

Results are stored as `chart1` in DynamoDB with this structure:

```json
{
  "yearly_forecast": [
    {
      "year": 1,
      "investor_net_incomes": {"investor1": 75000.0},
      "combined_income": 75000.0,
      "investor_borrowing_capacities": {"investor1": 450000.0},
      "investor_debts": {"investor1": 0.0},
      "total_debt": 0.0,
      "total_rent": 0.0,
      "total_interest_cost": 0.0,
      "total_other_expenses": 0.0,
      "property_cashflow": 0.0,
      "household_surplus": 75000.0,
      "cashflow": 75000.0,
      "property_loan_balances": {},
      "property_lvrs": {},
      "property_values": {}
    }
  ]
}
```

## Testing

### Unit Tests

Run the test suite:

```bash
python test_update_table.py
```

Tests cover:
- Input validation
- Error handling
- Chart1 calculation
- API response formatting

### Manual Testing

Use the provided test payloads:

```bash
# API Gateway format
cat api_gateway_test_payload.json

# Direct Lambda format
cat sample_lambda_test_payload.json
```

### Local Testing

The Lambda function can be tested locally by calling `lambda_handler()` directly:

```python
from update_table import lambda_handler

event = {
    "body": json.dumps({
        "table_name": "test-table",
        "id": "test-id",
        "attributes": {"status": "active"}
    })
}

response = lambda_handler(event, None)
print(response)
```

## Error Handling

The function handles various error scenarios:

| HTTP Status | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Missing/invalid parameters |
| 404 | Not Found | Item doesn't exist |
| 500 | Internal Error | Database or processing errors |

## Security Considerations

- **Input Validation**: All inputs validated before processing
- **Parameterized Queries**: Uses boto3's built-in parameterization
- **IAM Permissions**: Least privilege access to DynamoDB
- **Error Sanitization**: Sensitive information not exposed in errors
- **Transaction Safety**: Optional atomic operations for critical updates

## Monitoring

### CloudWatch Metrics

- **Invocations**: Function call count
- **Duration**: Execution time
- **Errors**: Error count and types
- **Throttles**: Rate limiting events

### Logging

- **Console Logging**: All logs written to stdout/stderr
- **Structured Logs**: JSON-formatted log entries
- **Error Tracking**: Detailed error information with stack traces

## Maintenance

### Updating the Function

1. Modify `update_table.py`
2. Update `requirements.txt` if needed
3. Run code-only deployment: `python deploy_lamdba_code_only.py deploy.config`

### Version Management

- Use `deploy_lambda.py --destroy` to recreate function
- Lambda maintains version history automatically
- Rollback to previous versions via AWS Console or CLI

## Dependencies

- `boto3`: AWS SDK for Python
- `superchart1`: Custom chart calculation library

## License

This project is part of the BA Portal system. See main project license for details.