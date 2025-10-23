import boto3
import time
from botocore.exceptions import ClientError
from decimal import Decimal

# Configuration
region_name = 'ap-southeast-2'  # Sydney
table_name = 'hsc_agent_quiz_attempts'
partition_key = 'user_id'  # Primary key
sort_key = 'attempt_id'  # Sort key

# Sample JSON item to insert
sample_item = {
    'user_id': '192.168.1.1',           # Required partition key
    'attempt_id': '550e8400-e29b-41d4-a716-446655440000',     # Required sort key
    'timestamp': '2023-10-23T12:00:00',
    'success_percentage': Decimal('85.5')
}


def create_dynamodb_table(dynamodb):
    try:
        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': partition_key, 'KeyType': 'HASH'},  # Partition key
                {'AttributeName': sort_key, 'KeyType': 'RANGE'},  # Sort key
            ],
            AttributeDefinitions=[
                {'AttributeName': partition_key, 'AttributeType': 'S'},  # 'S' = String
                {'AttributeName': sort_key, 'AttributeType': 'S'},  # 'S' = String
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print(f"Creating table '{table_name}'...")
        table.wait_until_exists()
        print(f"Table '{table_name}' created successfully.")
        return table
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Table '{table_name}' already exists.")
            return dynamodb.Table(table_name)
        else:
            raise

def insert_item(table, item):
    response = table.put_item(Item=item)
    print("Item inserted:", response)

def main():
    # Connect to DynamoDB
    dynamodb = boto3.resource('dynamodb', region_name=region_name)

    # Create table if not exists
    table = create_dynamodb_table(dynamodb)

    # Insert sample item
    insert_item(table, sample_item)

if __name__ == '__main__':
    main()
