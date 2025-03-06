import boto3
import sys

# AWS Configuration
DEFAULT_AWS_REGION = "ap-southeast-2"  # Sydney
FALLBACK_AWS_REGION = "us-east-1"
domain_name = "cognifylabs.com.au"  # Update with your domain name

# Clients
ses_client = boto3.client("ses", region_name=DEFAULT_AWS_REGION)
route53_client = boto3.client("route53")
rollback_actions = []

def rollback():
    print("Rolling back...")
    for action in reversed(rollback_actions):
        try:
            action()
        except Exception as e:
            print(f"Rollback failed: {e}")
    sys.exit("Script failed and was rolled back.")

try:
    # Step 1: Verify Domain in SES
    try:
        response = ses_client.verify_domain_identity(Domain=domain_name)
    except Exception as e:
        print("Failed in Sydney, retrying in us-east-1...")
        ses_client = boto3.client("ses", region_name=FALLBACK_AWS_REGION)
        response = ses_client.verify_domain_identity(Domain=domain_name)
        rollback_actions.append(lambda: ses_client.delete_identity(Identity=domain_name))
    print(f"Domain verification token: {response['VerificationToken']}")

    # Step 2: Configure DKIM
    dkim_response = ses_client.verify_domain_dkim(Domain=domain_name)
    rollback_actions.append(lambda: ses_client.delete_identity(Identity=domain_name))
    print(f"DKIM Tokens: {dkim_response['DkimTokens']}")

    # Step 3: Get Hosted Zone ID
    hosted_zones = route53_client.list_hosted_zones_by_name(DNSName=domain_name)
    hosted_zone_id = hosted_zones["HostedZones"][0]["Id"].split("/")[-1]
    
    # Step 4: Setup Route 53 Records
    changes = [
        {  # TXT Record for SES Verification
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": f"_amazonses.{domain_name}",
                "Type": "TXT",
                "TTL": 300,
                "ResourceRecords": [{"Value": f'"{response["VerificationToken"]}"'}]
            }
        }
    ]

    # DKIM Records
    for dkim in dkim_response["DkimTokens"]:
        changes.append({
            "Action": "CREATE",
            "ResourceRecordSet": {
                "Name": f"{dkim}._domainkey.{domain_name}",
                "Type": "CNAME",
                "TTL": 300,
                "ResourceRecords": [{"Value": f"{dkim}.dkim.amazonses.com"}]
            }
        })

    # Update Route 53
    route53_client.change_resource_record_sets(
        HostedZoneId=hosted_zone_id,
        ChangeBatch={"Changes": changes}
    )
    rollback_actions.append(lambda: route53_client.change_resource_record_sets(
        HostedZoneId=hosted_zone_id,
        ChangeBatch={"Changes": [{"Action": "DELETE", "ResourceRecordSet": c["ResourceRecordSet"]} for c in changes]}
    ))

    print("AWS SES setup for sending emails completed successfully!")

except Exception as e:
    print(f"Error: {e}")
    rollback()
