# Table Update Lambda Function

A serverless solution for dynamically updating DynamoDB table attributes with comprehensive error handling, transactional integrity, and optional audit logging.

## Features

- **Secure Parameterized Queries**: Prevents SQL injection and ensures data integrity
- **Transactional Updates**: Atomic operations with rollback on failure
- **Comprehensive Error Handling**: Graceful handling of database errors, validation errors, and edge cases
- **Audit Logging**: Optional logging for tracking changes and debugging
- **Flexible Configuration**: Environment variables for easy deployment across environments

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
│  │ 3. Transaction Management                                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 4. Parameterized Query Execution                         │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 5. Error Handling & Rollback                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 6. Audit Logging (Optional)                              │  │
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
- AWS Lambda execution role with DynamoDB permissions

### Deployment Steps

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables**:
   - `TABLE_NAME`: Name of your DynamoDB table
   - `LOG_LEVEL`: Logging level (DEBUG, INFO, WARNING, ERROR)
   - `ENABLE_AUDIT_LOG`: Set to "true" to enable audit logging

3. **Deploy the Lambda function**:
   ```bash
   python deploy_lambda.py
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
| `ENABLE_AUDIT_LOG` | Enable audit logging | false | No |
| `AUDIT_LOG_TABLE` | Table for audit logs | audit_logs | No |

## Usage

### Lambda Invocation

```python
import boto3
import json

lambda_client = boto3.client('lambda')

response = lambda_client.invoke(
    FunctionName='table-update-function',
    InvocationType='RequestResponse',
    Payload=json.dumps({
        'id': 'user-123',
        'attributes': {
            'name': 'John Doe',
            'email': 'john@example.com',
            'status': 'active'
        },
        'enable_logging': True
    })
)

result = json.loads(response['Payload'].read())
print(result)
```

### Expected Input Format

```json
{
  "id": "string",              // Required: Primary key/ID of the record
  "attributes": {                // Required: Dictionary of attributes to update
    "attribute_name": "value",
    "another_attribute": 123
  },
  "enable_logging": true,        // Optional: Enable audit logging
  "condition_expression": "attribute_not_exists(email)"  // Optional: Conditional update
}
```

### Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Record updated successfully",
  "updated_id": "user-123",
  "updated_attributes": ["name", "email", "status"],
  "timestamp": "2024-01-08T01:34:32.343Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "InvalidInputError",
  "message": "ID and attributes are required",
  "details": {
    "missing_fields": ["id", "attributes"]
  },
  "timestamp": "2024-01-08T01:34:32.343Z"
}
```

## Error Handling

The function handles various error scenarios:

| Error Type | HTTP Status | Description |
|------------|-------------|-------------|
| `InvalidInputError` | 400 | Missing or invalid input parameters |
| `DatabaseError` | 500 | Database connection or query failures |
| `RecordNotFoundError` | 404 | Record with specified ID not found |
| `ValidationError` | 400 | Data validation failures |
| `ConditionalCheckFailed` | 412 | Conditional update failed |

## Audit Logging

When enabled, the function logs all update operations to a separate DynamoDB table:

```json
{
  "log_id": "unique-id",
  "timestamp": "2024-01-08T01:34:32.343Z",
  "table_name": "your-table",
  "record_id": "user-123",
  "updated_attributes": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "user_agent": "lambda-function",
  "status": "success"
}
```

## Security Considerations

- **Parameterized Queries**: All database queries use parameterized inputs
- **Input Validation**: Comprehensive validation of all input data
- **Least Privilege**: IAM role has minimal required permissions
- **Error Sanitization**: Error messages don't expose sensitive information
- **Audit Trail**: Complete history of all update operations

## Performance Optimization

- **Batch Processing**: Multiple attributes updated in single operation
- **Connection Pooling**: Reused database connections
- **Minimal Logging**: Only essential information logged
- **Efficient Queries**: Optimized DynamoDB operations

## Testing

The function includes comprehensive unit tests covering:

- Input validation scenarios
- Database error conditions
- Transaction rollback scenarios
- Audit logging verification
- Performance benchmarks

## Monitoring

Recommended CloudWatch alarms:

- Error rate > 1%
- Duration > 1s
- Throttles > 0
- Concurrent executions > 100

## Maintenance

### Updating the Function

1. Make changes to `update_table_attributes.py`
2. Update `requirements.txt` if dependencies change
3. Run `python deploy_lambda.py`

### Rolling Back

```bash
# List versions
aws lambda list-versions-by-function --function-name table-update-function

# Publish new version
aws lambda publish-version --function-name table-update-function

# Rollback to specific version
aws lambda update-function-configuration --function-name table-update-function \
  --version VERSION_NUMBER
```

## Troubleshooting

**Common Issues:**

- **Permission Errors**: Verify IAM role has DynamoDB permissions
- **Timeout Errors**: Increase Lambda timeout or optimize queries
- **Throttling**: Check DynamoDB capacity and adjust provisioning
- **Cold Starts**: Consider provisioned concurrency for critical functions

**Debugging:**

```bash
# View CloudWatch logs
aws logs get-log-events --log-group-name /aws/lambda/table-update-function \
  --log-stream-name $(aws logs describe-log-streams --log-group-name /aws/lambda/table-update-function \
    --query 'logStreams[0].logStreamName' --output text) \
  --query 'events[].message' --output text
```

## License

MIT License - See LICENSE file for details.