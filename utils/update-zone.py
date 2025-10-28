import boto3
import sys

def add_dns_records(zone_id, domain_name, api_endpoint, ttl=300):
    """
    Adds or updates two DNS records in the specified Route53 hosted zone:
      1. www.<domain> → <domain>
      2. api.<domain> → <api_endpoint>
    """

    domain_name = domain_name.rstrip('.')
    www_name = f"www.{domain_name}"
    api_name = f"api.{domain_name}"

    client = boto3.client('route53')

    changes = [
        {
            'Action': 'UPSERT',
            'ResourceRecordSet': {
                'Name': www_name,
                'Type': 'CNAME',
                'TTL': ttl,
                'ResourceRecords': [{'Value': domain_name}]
            }
        },
        {
            'Action': 'UPSERT',
            'ResourceRecordSet': {
                'Name': api_name,
                'Type': 'CNAME',
                'TTL': ttl,
                'ResourceRecords': [{'Value': api_endpoint.rstrip('.')}]
            }
        }
    ]

    response = client.change_resource_record_sets(
        HostedZoneId=zone_id,
        ChangeBatch={
            'Comment': f'Add www and api CNAMEs for {domain_name}',
            'Changes': changes
        }
    )

    print(f"✅ Successfully added/updated DNS records for {domain_name}")
    print(f" - www.{domain_name} → {domain_name}")
    print(f" - api.{domain_name} → {api_endpoint}")
    print(f"Change Info: {response['ChangeInfo']}")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python update-zone.py <zone_id> <domain_name> <api_endpoint>")
        print("Example: python update-zone.py Z123456ABCDEF example.com abc123.execute-api.ap-southeast-2.amazonaws.com")
        sys.exit(1)

    zone_id = sys.argv[1]
    domain_name = sys.argv[2]
    api_endpoint = sys.argv[3]

    add_dns_records(zone_id, domain_name, api_endpoint)
