# Dynamic DynamoDB Attribute Updater - Lambda Version

A Lambda function that dynamically updates specified attributes of a DynamoDB table by accepting payloads from API Gateway. This is a serverless version of the dynamic update script with full API Gateway integration.

## Features

- **API Gateway Integration**: Accepts HTTP requests from API Gateway
- **Automatic System Updates**: Every successful update increments `number_of_updates` by 1 and updates `last_updated_date`
- **Secure Parameterized Queries**: Uses boto3's built-in parameterization
- **Transactional Integrity**: Supports DynamoDB transactions
- **Comprehensive Error Handling**: Robust error handling with proper HTTP status codes
- **Console Logging**: Basic logging to console for debugging (file logging removed for container compatibility)
- **Input Validation**: Validates all input parameters

## API Endpoint

### Request Format

**HTTP Method**: `POST`

**Path**: `/update`

**Headers**:
- `Content-Type: application/json`

**Body**:
```json
{
    "table_name": "BA-PORTAL-BASETABLE",
    "id": "item-id-here",
    "attributes": {
        "status": "active",
        "adviser_name": "John Doe"
    },
    "use_transaction": false,
    "enable_logging": false,
    "region": "ap-southeast-2"
}
```

### Response Format

**Success Response (200)**:
```json
{
    "message": "Update successful",
    "item_id": "item-id-here",
    "updated_attributes": ["status", "adviser_name"],
    "result": {
        "id": "item-id-here",
        "status": "active",
        "adviser_name": "John Doe",
        "number_of_updates": 1,
        "last_updated_date": "2023-01-01T12:00:00.000000"
    }
}
```

**Error Response (400/404/500)**:
```json
{
    "error": "Error message here"
}
```

## Parameters

| Parameter | Required | Type | Description | Default |
|-----------|----------|------|-------------|---------|
| `table_name` | Yes | String | Name of the DynamoDB table | - |
| `id` | Yes | String | ID of the item to update | - |
| `attributes` | Yes | Object | JSON object of attributes to update | - |
| `use_transaction` | No | Boolean | Use DynamoDB transaction | `false` |
| `enable_logging` | No | Boolean | Enable audit logging | `false` |
| `region` | No | String | AWS region | `ap-southeast-2` |

## Deployment

### Prerequisites

1. **AWS CLI configured** with proper permissions
2. **Lambda execution role** with DynamoDB permissions
3. **API Gateway** set up to trigger the Lambda

### Deployment Steps

1. **Create Lambda Function**:
```bash
aws lambda create-function \
    --function-name DynamicDynamoDBUpdater \
    --runtime python3.9 \
    --role arn:aws:iam::your-account:role/lambda-dynamodb-role \
    --handler dynamic_update_lambda.lambda_handler \
    --zip-file fileb://lambda-package.zip
```

2. **Create API Gateway**:
```bash
aws apigateway create-rest-api --name DynamoDBUpdaterAPI
```

3. **Create Resource and Method**:
```bash
# Get API ID
API_ID=$(aws apigateway get-rest-apis --query "items[?name=='DynamoDBUpdaterAPI'].id" --output text)

# Create resource
aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/'].id" --output text) \
    --path-part update

# Create POST method
RESOURCE_ID=$(aws apigateway get-resources --rest-api-id $API_ID --query "items[?path=='/update'].id" --output text)

aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --authorization-type NONE
```

4. **Integrate with Lambda**:
```bash
# Get Lambda ARN
LAMBDA_ARN=$(aws lambda get-function --function-name DynamicDynamoDBUpdater --query Configuration.FunctionArn --output text)

aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $RESOURCE_ID \
    --http-method POST \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri arn:aws:apigateway:ap-southeast-2:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations
```

5. **Deploy API**:
```bash
aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod
```

## Local Testing

The Lambda function includes a `main()` function for local testing:

```bash
cd app/ba-portal
python dynamic_update_lambda.py
```

This will simulate a Lambda invocation with a test event.

## Error Handling

The Lambda function handles various error scenarios:

- **400 Bad Request**: Missing parameters, invalid JSON, validation errors
- **404 Not Found**: Item doesn't exist in the table
- **500 Internal Server Error**: Unexpected errors, DynamoDB issues

## Security Considerations

1. **API Gateway Authentication**: Add API keys or IAM authentication
2. **Input Validation**: All inputs are validated before processing
3. **Reserved Field Protection**: Prevents updates to critical system fields
4. **Parameterized Queries**: Prevents injection attacks
5. **IAM Permissions**: Lambda role should have least privilege access

## Example Usage

### cURL Example

```bash
curl -X POST \
  https://your-api-id.execute-api.ap-southeast-2.amazonaws.com/prod/update \
  -H 'Content-Type: application/json' \
  -d '{
    "table_name": "BA-PORTAL-BASETABLE",
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "attributes": {
        "status": "active",
        "adviser_name": "John Doe"
    },
    "use_transaction": true,
    "enable_logging": true
  }'
```

### Python Example

```python
import requests
import json

url = "https://your-api-id.execute-api.ap-southeast-2.amazonaws.com/prod/update"

payload = {
    "table_name": "BA-PORTAL-BASETABLE",
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "attributes": {
        "status": "active",
        "adviser_name": "John Doe"
    },
    "use_transaction": True,
    "enable_logging": True
}

response = requests.post(url, json=payload)
print(response.status_code)
print(response.json())
```

## Monitoring and Logging

- **CloudWatch Logs**: All Lambda invocations are logged automatically
- **Console Logging**: All logs are written to console (stdout/stderr) for compatibility with containerized environments
- **CloudWatch Metrics**: Monitor invocation counts, errors, and performance

## Best Practices

1. **Use Transactions for Critical Updates**: Set `use_transaction: true` for important data
2. **Enable Logging for Production**: Use `enable_logging: true` for audit trails
3. **Validate Inputs**: Ensure your JSON payload is properly formatted
4. **Handle Errors Gracefully**: Check HTTP status codes and error messages
5. **Monitor Performance**: Transactional updates have higher latency but better integrity

## Troubleshooting

**Issue: "Item not found" (404)**
- Solution: Verify the item ID exists in your DynamoDB table

**Issue: "Invalid attribute name: id" (400)**
- Solution: The 'id' attribute is reserved and cannot be updated

**Issue: Authentication errors**
- Solution: Configure API Gateway authentication (API keys, IAM, or Cognito)

**Issue: Lambda timeout**
- Solution: Increase Lambda timeout setting for large updates

**Issue: Permission denied**
- Solution: Ensure Lambda execution role has DynamoDB update permissions