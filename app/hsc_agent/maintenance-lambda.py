import boto3

if __name__ == "__main__":
    regions = ['us-east-1', 'ap-southeast-2']

    for region in regions:
        client = boto3.client('logs', region_name=region)

        paginator = client.get_paginator('describe_log_groups')
        for page in paginator.paginate():
            for log_group in page['logGroups']:
                log_group_name = log_group['logGroupName']
                try:
                    client.put_retention_policy(
                        logGroupName=log_group_name,
                        retentionInDays=3
                    )
                    print(f"Set retention to 3 days for log group: {log_group_name} in region: {region}")
                except Exception as e:
                    print(f"Error setting retention for log group: {log_group_name} in region: {region} - {str(e)}")

    print("Maintenance completed: Set retention to 3 days for all CloudWatch log groups in us-east-1 and ap-southeast-2")