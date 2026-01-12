# Table Insert Lambda Function

A serverless solution for inserting items into DynamoDB tables with support for single item insertion, batch operations, and conditional writes. Includes comprehensive error handling, proper logging, and AWS SDK integration.

## Features

- **Secure Parameterized Queries**: Prevents SQL injection and ensures data integrity
- **Multiple Insert Operations**: Single item insertion, batch operations, and conditional writes
- **Comprehensive Error Handling**: Graceful handling of database errors, validation errors, and edge cases
- **Flexible Configuration**: Environment variables for easy deployment across environments
- **API Gateway Integration**: Ready for REST API deployment

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        API Gateway / CLI                        │
└───────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────┐
│                     Lambda Function (Python)                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 1. Input Validation & Sanitization                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 2. Database Connection Management                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 3. Insert Operation Execution                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 4. Error Handling & Response Formatting                   │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────┐
│                         DynamoDB Table                         │
└───────────────────────────────────────────────────────────────┘
```

## Deployment

### Prerequisites

- AWS CLI configured with appropriate permissions
- Python 3.12+
- AWS Lambda execution role with DynamoDB write permissions

### Deployment Steps

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables**:
   - `TABLE_NAME`: Name of your DynamoDB table
   - `LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)

3. **Deploy the Lambda function**:
   ```bash
   # Use AWS CLI or your preferred deployment method
   aws lambda create-function \
     --function-name ba-portal-insert-table-lambda-function \
     --runtime python3.13 \
     --handler insert_table.lambda_handler \
     --role arn:aws:iam::YOUR_ACCOUNT_ID:role/ba-portal-insert-table-lambda-role \
     --zip-file fileb://deployment-package.zip \
     --region ap-southeast-2
   ```

4. **Set up API Gateway (optional)**:
   - Create a REST API with a POST method
   - Connect to the Lambda function
   - Set up appropriate authentication

### Configuration Options

| Environment Variable | Description | Default | Required |
|---------------------|-------------|---------|----------|
| `TABLE_NAME` | Name of the DynamoDB table | N/A | Yes |
| `LOG_LEVEL` | Logging verbosity level | INFO | No |
| `REGION` | AWS region | ap-southeast-2 | No |

## Usage

### Lambda Invocation

**Single Item Insertion:**
```python
import boto3
import json

lambda_client = boto3.client('lambda')

response = lambda_client.invoke(
    FunctionName='ba-portal-insert-table-lambda-function',
    InvocationType='RequestResponse',
    Payload=json.dumps({
        'table_name': 'your-table-name',
        'item': {
            'id': 'user-123',
            'name': 'John Doe',
            'email': 'john@example.com',
            'status': 'active'
        }
    })
)

result = json.loads(response['Payload'].read())
print(result)
```

**Batch Insertion:**
```python
response = lambda_client.invoke(
    FunctionName='ba-portal-insert-table-lambda-function',
    InvocationType='RequestResponse',
    Payload=json.dumps({
        'table_name': 'your-table-name',
        'items': [
            {
                'id': 'user-123',
                'name': 'John Doe',
                'status': 'active'
            },
            {
                'id': 'user-456',
                'name': 'Jane Smith',
                'status': 'active'
            }
        ]
    })
)
```

**Conditional Insertion:**
```python
response = lambda_client.invoke(
    FunctionName='ba-portal-insert-table-lambda-function',
    InvocationType='RequestResponse',
    Payload=json.dumps({
        'table_name': 'your-table-name',
        'item': {
            'id': 'user-123',
            'name': 'John Doe',
            'email': 'john@example.com'
        },
        'condition_expression': 'attribute_not_exists(id)'
    })
)
```

### Expected Input Format

**Single Item Insertion:**
```json
{
  "table_name": "string",              // Required: Name of the DynamoDB table
  "item": {                            // Required: Item to insert
    "id": "string",                    // Required: Primary key/ID of the record
    "name": "string",                  // Optional: Item attributes
    "email": "string",                 // Optional: Item attributes
    "status": "string"                 // Optional: Item attributes
  },
  "condition_expression": "string",    // Optional: Conditional expression
  "region": "ap-southeast-2"           // Optional: AWS region
}
```

**Batch Insertion:**
```json
{
  "table_name": "string",              // Required: Name of the DynamoDB table
  "items": [                            // Required: Array of items to insert
    {
      "id": "string",                  // Required: Primary key/ID of the record
      "name": "string",                // Optional: Item attributes
      "status": "string"               // Optional: Item attributes
    }
  ],
  "region": "ap-southeast-2"           // Optional: AWS region
}
```

### Response Format

**Success Response (Single Item):**
```json
{
  "status": "success",
  "message": "Item insertion successful",
  "item_id": "user-123",
  "result": {
    "id": "user-123",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active",
    "created_date": "2024-01-08T01:34:32.343Z",
    "last_updated_date": "2024-01-08T01:34:32.343Z",
    "number_of_updates": 0
  }
}
```

**Success Response (Batch):**
```json
{
  "status": "success",
  "message": "Batch insertion successful",
  "items_inserted": 2,
  "result": [
    {
      "id": "user-123",
      "name": "John Doe",
      "status": "active",
      "created_date": "2024-01-08T01:34:32.343Z",
      "last_updated_date": "2024-01-08T01:34:32.343Z",
      "number_of_updates": 0
    },
    {
      "id": "user-456",
      "name": "Jane Smith",
      "status": "active",
      "created_date": "2024-01-08T01:34:32.343Z",
      "last_updated_date": "2024-01-08T01:34:32.343Z",
      "number_of_updates": 0
    }
  ]
}
```

**Error Response (Duplicate Item):**
```json
{
  "status": "error",
  "message": "Item with ID 'user-123' already exists in table 'your-table-name'"
}
```

**Error Response (Validation):**
```json
{
  "status": "error",
  "message": "Item must contain an 'id' field as primary key"
}
```

## Error Handling

The function handles various error scenarios:

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `InvalidInputError` | 400 | Missing or invalid input parameters |
| `DatabaseError` | 500 | Database connection or insert failures |
| `DuplicateItemError` | 409 | Item with specified ID already exists |
| `ValidationError` | 400 | Data validation failures |
| `ConditionalCheckFailed` | 412 | Conditional insert failed |

## Security Considerations

- **Parameterized Queries**: All database queries use parameterized inputs
- **Input Validation**: Comprehensive validation of all input data
- **Least Privilege**: IAM role has minimal required permissions
- **Error Sanitization**: Error messages don't expose sensitive information
- **Duplicate Prevention**: Checks for existing items before insertion

## Performance Optimization

- **Batch Processing**: Multiple items inserted in single operation
- **Connection Pooling**: Reused database connections
- **Minimal Logging**: Only essential information logged
- **Efficient Queries**: Optimized DynamoDB operations

## Testing

The function includes comprehensive unit tests covering:

- Input validation scenarios
- Database error conditions
- Batch operation scenarios
- Conditional write scenarios
- Performance benchmarks

## Monitoring

Recommended CloudWatch alarms:

- Error rate > 1%
- Duration > 1s
- Throttles > 0
- Concurrent executions > 100

## Maintenance

### Updating the Function

1. Make changes to `insert_table.py`
2. Update `requirements.txt` if dependencies change
3. Redeploy the Lambda function

### Rolling Back

```bash
# List versions
aws lambda list-versions-by-function --function-name ba-portal-insert-table-lambda-function

# Publish new version
aws lambda publish-version --function-name ba-portal-insert-table-lambda-function

# Rollback to specific version
aws lambda update-function-configuration --function-name ba-portal-insert-table-lambda-function \
  --version VERSION_NUMBER
```

## Troubleshooting

**Common Issues:**

- **Permission Errors**: Verify IAM role has DynamoDB write permissions
- **Timeout Errors**: Increase Lambda timeout or optimize queries
- **Throttling**: Check DynamoDB capacity and adjust provisioning
- **Cold Starts**: Consider provisioned concurrency for critical functions
- **Duplicate Errors**: Use conditional expressions or check for existing items

**Debugging:**

```bash
# View CloudWatch logs
aws logs get-log-events --log-group-name /aws/lambda/ba-portal-insert-table-lambda-function \
  --log-stream-name $(aws logs describe-log-streams --log-group-name /aws/lambda/ba-portal-insert-table-lambda-function \
    --query 'logStreams[0].logStreamName' --output text) \
  --query 'events[].message' --output text
```

## License

MIT License - See LICENSE file for details.