# Dynamic DynamoDB Attribute Updater

A Python script that dynamically updates specified attributes of a DynamoDB table by accepting an ID and a dictionary of attribute-value pairs, ensuring secure parameterized queries, transactional integrity, and comprehensive error handling for database operations, with optional logging for audit trails.

## Features

- **Dynamic Attribute Updates**: Update any attributes of a DynamoDB item using a simple key-value dictionary
- **Automatic System Updates**: Every successful update automatically increments `number_of_updates` by 1 and updates `last_updated_date` with current timestamp
- **Secure Parameterized Queries**: Uses boto3's built-in parameterization to prevent injection attacks
- **Transactional Integrity**: Supports both regular updates and DynamoDB transactions for enhanced data integrity
- **Comprehensive Error Handling**: Robust error handling with custom exceptions and detailed error messages
- **Console Logging**: Basic logging to console for debugging (file logging removed for container compatibility)
- **Input Validation**: Validates attribute names and values before attempting updates
- **Reserved Attribute Protection**: Prevents updates to reserved attributes like 'id'

## Automatic System Updates

Every successful update automatically performs the following system updates:

1. **Increment `number_of_updates`**: The `number_of_updates` field is automatically incremented by 1 for each successful update
2. **Update `last_updated_date`**: The `last_updated_date` field is automatically set to the current timestamp in ISO format

These automatic updates are performed regardless of whether you use regular updates or transactions, and they cannot be disabled. This ensures consistent tracking of all modifications to your data.

**Note**: These system fields are automatically managed and should not be included in your attributes JSON. If you try to manually update `number_of_updates` or `last_updated_date`, your values will be overridden by the automatic system updates.

## Requirements

- Python 3.7+
- boto3 (AWS SDK for Python)
- AWS credentials configured with appropriate DynamoDB permissions

## Installation

1. Install the required dependencies:

```bash
pip install boto3
```

2. Ensure your AWS credentials are properly configured. You can configure them using:

```bash
aws configure
```

Or set environment variables:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=your_region
```

## Usage

### Basic Usage

```bash
python dynamic_update_script.py \
    --table_name BA-PORTAL-BASETABLE \
    --id "your-item-id" \
    --attributes '{"status": "active", "last_updated": "2023-01-01"}'
```

### With Logging

```bash
python dynamic_update_script.py \
    --table_name BA-PORTAL-BASETABLE \
    --id "your-item-id" \
    --attributes '{"status": "inactive"}' \
    --enable_logging
```

### With Transaction

```bash
python dynamic_update_script.py \
    --table_name BA-PORTAL-BASETABLE \
    --id "your-item-id" \
    --attributes '{"critical_field": "new_value"}' \
    --enable_logging \
    --use_transaction
```

## Command Line Arguments

| Argument | Required | Description | Default |
|----------|----------|-------------|---------|
| `--table_name` | Yes | Name of the DynamoDB table to update | - |
| `--id` | Yes | ID of the item to update | - |
| `--attributes` | Yes | JSON string of attributes to update | - |
| `--region` | No | AWS region | `ap-southeast-2` |
| `--enable_logging` | No | Enable logging for audit trails | False |
| `--use_transaction` | No | Use DynamoDB transaction for enhanced integrity | False |

## Examples

### Example 1: Simple Update

```bash
python dynamic_update_script.py \
    --table_name BA-PORTAL-BASETABLE \
    --id "123e4567-e89b-12d3-a456-426614174000" \
    --attributes '{"status": "active", "update_count": 5}'
```

### Example 2: Complex Data Types

```bash
python dynamic_update_script.py \
    --table_name BA-PORTAL-BASETABLE \
    --id "123e4567-e89b-12d3-a456-426614174000" \
    --attributes '{"nested_data": {"field1": "value1", "field2": 42}, "array_data": [1, 2, 3]}'
```

### Example 3: With All Options

```bash
python dynamic_update_script.py \
    --table_name BA-PORTAL-BASETABLE \
    --id "123e4567-e89b-12d3-a456-426614174000" \
    --attributes '{"critical_field": "important_value", "timestamp": "2023-01-01T12:00:00Z"}' \
    --region us-west-2 \
    --enable_logging \
    --use_transaction
```

## Error Handling

The script includes comprehensive error handling for:

- Invalid input parameters
- Missing or malformed JSON attributes
- DynamoDB client errors
- Network connectivity issues
- Permission errors
- Item not found errors
- Reserved attribute updates

## Logging

The script now uses console-based logging only (file logging removed for container compatibility):

1. Logs all update attempts with timestamps to console
2. Logs successful updates to console
3. Logs errors with detailed information to console
4. Uses different log levels: INFO, ERROR, WARNING, DEBUG

**Note**: File-based logging has been removed as it's not suitable for containerized environments and Lambda functions.

## Security Features

1. **Parameterized Queries**: All DynamoDB operations use boto3's parameterized queries to prevent injection attacks
2. **Input Validation**: Validates all input parameters before processing
3. **Reserved Attribute Protection**: Prevents updates to critical system attributes
4. **Error Handling**: Comprehensive error handling prevents sensitive information leakage
5. **Logging Security**: Audit logs contain operation details without sensitive data

## Transaction Support

The `--use_transaction` flag enables DynamoDB transactions which provide:

- **Atomicity**: The entire update operation succeeds or fails as a unit
- **Consistency**: Ensures data consistency across the operation
- **Isolation**: Prevents interference from other operations
- **Durability**: Guarantees that completed transactions are permanent

## Best Practices

1. **Use Transactions for Critical Updates**: For important data, use `--use_transaction`
2. **Enable Logging for Audit Trails**: Use `--enable_logging` for production environments
3. **Validate Inputs**: Ensure your JSON attributes are properly formatted
4. **Test with Non-Critical Data**: Test updates on non-production data first
5. **Monitor Performance**: Transactional updates have higher latency but better integrity

## Troubleshooting

### Common Issues

**Issue: "Item with ID 'xxx' does not exist"**
- Solution: Verify the item ID exists in your DynamoDB table

**Issue: "Invalid attribute name: id"**
- Solution: The 'id' attribute is reserved and cannot be updated

**Issue: AWS credentials not found**
- Solution: Configure AWS credentials using `aws configure` or environment variables

**Issue: Access denied or permission errors**
- Solution: Ensure your IAM user has DynamoDB update permissions

**Issue: JSON parsing errors**
- Solution: Verify your attributes JSON is properly formatted

## License

This script is provided as-is and can be used according to your project's licensing terms.

## Support

For issues or questions, refer to the AWS DynamoDB documentation or consult with your development team.