import boto3
import time
import uuid
from botocore.exceptions import ClientError
from decimal import Decimal

# Configuration
region_name = 'ap-southeast-2'  # Sydney
table_name = 'hsc_agent_quiz_attempts'
partition_key = 'attempt_id'  # UUID as partition key

# Questions mapping table
questions_table_name = 'hsc_agent_questions_mapping'
questions_partition_key = 'id'  # UUID as partition key

# Sample JSON item to insert
sample_item = {
    'attempt_id': '550e8400-e29b-41d4-a716-446655440000',     # Partition key: UUID
    'user_id': '192.168.1.1',           # User identifier
    'timestamp': '2023-10-23T12:00:00',
    'success_percentage': Decimal('85.5'),
    'questions_mapping_id': None  # Will be set after creating questions table
}

# Sample item for questions mapping table
sample_questions_item = {
    'id': str(uuid.uuid4()),                  # Partition key: UUID
    'year': '12',                             # Year
    'subject': 'Advanced English',            # Subject
    'area': 'vocab',                          # Area
    'stage': '1',                          # Stage
    'location': 'data/1984_vocab.json'        # Location prefix of questions.json file
}


def create_dynamodb_table(dynamodb):
    try:
        # Check if table exists and delete if it has wrong schema
        try:
            desc = dynamodb.meta.client.describe_table(TableName=table_name)
            key_schema = desc['Table']['KeySchema']
            if key_schema[0]['AttributeName'] != 'attempt_id':
                print(f"Table '{table_name}' has wrong schema, deleting and recreating...")
                dynamodb.meta.client.delete_table(TableName=table_name)
                # Wait for deletion
                waiter = dynamodb.meta.client.get_waiter('table_not_exists')
                waiter.wait(TableName=table_name)
                print(f"Deleted old table '{table_name}'.")
        except ClientError as e:
            if e.response['Error']['Code'] != 'ResourceNotFoundException':
                raise

        table = dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': partition_key, 'KeyType': 'HASH'},  # Partition key: attempt_id (UUID)
            ],
            AttributeDefinitions=[
                {'AttributeName': partition_key, 'AttributeType': 'S'},  # 'S' = String
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

def create_questions_mapping_table(dynamodb):
    try:
        # Check if table exists and delete if it has wrong schema
        try:
            desc = dynamodb.meta.client.describe_table(TableName=questions_table_name)
            key_schema = desc['Table']['KeySchema']
            if key_schema[0]['AttributeName'] != 'id':
                print(f"Table '{questions_table_name}' has wrong schema, deleting and recreating...")
                dynamodb.meta.client.delete_table(TableName=questions_table_name)
                # Wait for deletion
                waiter = dynamodb.meta.client.get_waiter('table_not_exists')
                waiter.wait(TableName=questions_table_name)
                print(f"Deleted old table '{questions_table_name}'.")
        except ClientError as e:
            if e.response['Error']['Code'] != 'ResourceNotFoundException':
                raise

        table = dynamodb.create_table(
            TableName=questions_table_name,
            KeySchema=[
                {'AttributeName': questions_partition_key, 'KeyType': 'HASH'},  # Partition key: id (UUID)
            ],
            AttributeDefinitions=[
                {'AttributeName': questions_partition_key, 'AttributeType': 'S'},  # 'S' = String
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print(f"Creating table '{questions_table_name}'...")
        table.wait_until_exists()
        print(f"Table '{questions_table_name}' created successfully.")
        return table
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Table '{questions_table_name}' already exists.")
            return dynamodb.Table(questions_table_name)
        else:
            raise

def insert_item(table, item):
    response = table.put_item(Item=item)
    print(f"Item inserted into {table.table_name}: {response}")

def insert_questions_item(table, item):
    response = table.put_item(Item=item)
    print(f"Sample questions mapping item inserted into {table.table_name}: {response}")

def main():
    # Connect to DynamoDB
    dynamodb = boto3.resource('dynamodb', region_name=region_name)

    # Create quiz attempts table if not exists
    table = create_dynamodb_table(dynamodb)

    # Create questions mapping table if not exists
    questions_table = create_questions_mapping_table(dynamodb)

    # Insert sample item into questions mapping table
    insert_questions_item(questions_table, sample_questions_item)

    # Update sample_item with the questions_mapping_id
    sample_item['questions_mapping_id'] = sample_questions_item['id']

    # Insert sample item into quiz attempts table
    insert_item(table, sample_item)

if __name__ == '__main__':
    main()
