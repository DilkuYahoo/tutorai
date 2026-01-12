# DynamoDB Read Table Lambda Function

## Overview

This Lambda function reads items from a DynamoDB table with specific requirements:

- Accepts `id` and `table_name` as required parameters
- Validates that neither field is empty or null
- Queries the specified DynamoDB table
- Filters records where the `status` field equals "active"
- Returns only the `chart1`, `investors`, and `properties` attributes for the matching `id`

## Features

- **Robust Parameter Validation**: Comprehensive validation for required parameters
- **Status Filtering**: Only returns items with `status='active'`
- **Attribute Filtering**: Returns only `chart1`, `investors`, and `properties` attributes
- **Comprehensive Error Handling**: Custom exceptions and proper HTTP status codes
- **Structured Logging**: Detailed logging for debugging and monitoring
- **AWS SDK Integration**: Proper boto3 integration with DynamoDB

## API Endpoint

```
POST /read-table
```

## Request Format

### Direct Lambda Invocation

```json
{
  "table_name": "BA-PORTAL-BASETABLE",
  "id": "B57153AB-B66E-4085-A4C1-929EC158FC3E",
  "region": "ap-southeast-2"
}
```

### API Gateway Proxy Integration

```json
{
  "body": "{\n    \"table_name\": \"BA-PORTAL-BASETABLE\",\n    \"id\": \"B57153AB-B66E-4085-A4C1-929EC158FC3E\",\n    \"region\": \"ap-southeast-2\"\n  }"
}
```

## Response Format

### Success Response (200)

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true
  },
  "body": "{\n    \"status\": \"success\",\n    \"message\": \"Active item retrieval successful\",\n    \"item_id\": \"B57153AB-B66E-4085-A4C1-929EC158FC3E\",\n    \"table_name\": \"BA-PORTAL-BASETABLE\",\n    \"timestamp\": \"2023-01-01T00:00:00.000000\",\n    \"result\": {\n      \"id\": \"B57153AB-B66E-4085-A4C1-929EC158FC3E\",\n      \"chart1\": {},\n      \"investors\": [\n        {\n          \"name\": \"Bob\",\n          \"base_income\": 120000,\n          \"annual_growth_rate\": 3,\n          \"income_events\": []\n        }\n      ],\n      \"properties\": [\n        {\n          \"name\": \"Property A\",\n          \"purchase_year\": 1,\n          \"loan_amount\": 600000,\n          \"rent\": 30000,\n          \"interest_rate\": 5,\n          \"property_value\": 660000,\n          \"growth_rate\": 3,\n          \"investor_splits\": []\n        }\n      ]\n    }\n  }"
}
```

### Error Responses

#### Validation Error (400)

```json
{
  "statusCode": 400,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true
  },
  "body": "{\n    \"status\": \"error\",\n    \"message\": \"Missing or invalid required parameter: table_name\",\n    \"error_code\": \"VALIDATION_ERROR\",\n    \"timestamp\": \"2023-01-01T00:00:00.000000\"\n  }"
}
```

#### Not Found Error (404)

```json
{
  "statusCode": 404,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true
  },
  "body": "{\n    \"status\": \"error\",\n    \"message\": \"Item with ID 'B57153AB-B66E-4085-A4C1-929EC158FC3E' not found in table 'BA-PORTAL-BASETABLE'\",\n    \"error_code\": \"DYNAMODB_READ_ERROR\",\n    \"timestamp\": \"2023-01-01T00:00:00.000000\"\n  }"
}
```

#### Forbidden Error (403)

```json
{
  "statusCode": 403,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true
  },
  "body": "{\n    \"status\": \"error\",\n    \"message\": \"Item with ID 'B57153AB-B66E-4085-A4C1-929EC158FC3E' has status 'inactive', only 'active' items can be retrieved\",\n    \"error_code\": \"DYNAMODB_READ_ERROR\",\n    \"timestamp\": \"2023-01-01T00:00:00.000000\"\n  }"
}
```

#### Internal Server Error (500)

```json
{
  "statusCode": 500,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true
  },
  "body": "{\n    \"status\": \"error\",\n    \"message\": \"Unexpected Error: DynamoDB ClientError retrieving item B57153AB-B66E-4085-A4C1-929EC158FC3E\",\n    \"error_code\": \"INTERNAL_SERVER_ERROR\",\n    \"traceback\": \"...\",\n    \"timestamp\": \"2023-01-01T00:00:00.000000\"\n  }"
}
```

## Error Handling

The function implements comprehensive error handling with the following error codes:

| Status Code | Error Code | Description |
|-------------|------------|-------------|
| 400 | VALIDATION_ERROR | Missing or invalid parameters |
| 400 | DYNAMODB_READ_ERROR | General read operation errors |
| 403 | DYNAMODB_READ_ERROR | Item exists but status is not 'active' |
| 404 | DYNAMODB_READ_ERROR | Item not found |
| 500 | INTERNAL_SERVER_ERROR | Unexpected errors |

## Deployment

### Prerequisites

- AWS CLI configured with appropriate permissions
- Python 3.9+ runtime environment
- boto3 library (specified in requirements.txt)

### Environment Variables

```
AWS_REGION=ap-southeast-2
LOG_LEVEL=INFO
```

### IAM Permissions

The Lambda function requires the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:ap-southeast-2:*:table/BA-PORTAL-BASETABLE"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### Lambda Configuration

- **Runtime**: Python 3.9
- **Handler**: `read_table.lambda_handler`
- **Memory**: 128MB (adjust based on workload)
- **Timeout**: 10 seconds (adjust based on query complexity)
- **Environment Variables**: As specified above

## Testing

### Local Testing

```bash
python read_table.py
```

### AWS Lambda Testing

Use the provided test payloads:

- `sample_lambda_test_payload.json` for direct Lambda invocation
- `api_gateway_test_payload.json` for API Gateway testing

### Test Cases

1. **Valid Request**: Should return 200 with filtered attributes
2. **Missing Parameters**: Should return 400 validation error
3. **Invalid Parameters**: Should return 400 validation error
4. **Non-existent Item**: Should return 404 not found error
5. **Inactive Item**: Should return 403 forbidden error
6. **DynamoDB Errors**: Should return 500 internal server error

## Performance Optimization

- **Caching**: Consider adding caching for frequently accessed items
- **Batch Operations**: For multiple item retrievals, consider implementing batch operations
- **Indexing**: Ensure the DynamoDB table has proper indexes for efficient queries

## Security Considerations

- **Input Validation**: All inputs are thoroughly validated
- **Error Handling**: Sensitive information is not exposed in error messages
- **IAM Permissions**: Follow principle of least privilege
- **Logging**: Sensitive data is not logged

## Maintenance

- **Logging**: Monitor CloudWatch logs for errors and performance issues
- **Error Rates**: Set up alarms for high error rates
- **Dependencies**: Regularly update boto3 library
- **Testing**: Test with new data formats and edge cases

## Troubleshooting

### Common Issues

1. **400 Errors**: Check that all required parameters are provided and valid
2. **404 Errors**: Verify the item ID exists in the table
3. **403 Errors**: Ensure the item has status='active'
4. **500 Errors**: Check DynamoDB table permissions and connectivity

### Debugging

- Check CloudWatch logs for detailed error information
- Enable debug logging by setting LOG_LEVEL=DEBUG
- Test with sample payloads to verify basic functionality