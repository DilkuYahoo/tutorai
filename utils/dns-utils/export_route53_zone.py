import boto3
import sys

def export_route53_zone(zone_id, output_file):
    client = boto3.client("route53")

    print(f"Fetching records for zone ID: {zone_id}")
    paginator = client.get_paginator("list_resource_record_sets")
    records = []

    for page in paginator.paginate(HostedZoneId=zone_id):
        records.extend(page["ResourceRecordSets"])

    with open(output_file, "w") as f:
        for record in records:
            name = record["Name"]
            record_type = record["Type"]
            ttl = record.get("TTL", "")
            values = []

            # Handle alias targets (like ALIAS → CloudFront, ELB)
            if "AliasTarget" in record:
                target = record["AliasTarget"]["DNSName"]
                values.append(target)
            elif "ResourceRecords" in record:
                values = [r["Value"] for r in record["ResourceRecords"]]

            for value in values:
                line = f"{name}\t{ttl}\tIN\t{record_type}\t{value}\n"
                f.write(line)

    print(f"✅ Zone file exported successfully to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python export_route53_zone.py <HOSTED_ZONE_ID> <OUTPUT_FILE>")
        sys.exit(1)

    zone_id = sys.argv[1]
    output_file = sys.argv[2]

    export_route53_zone(zone_id, output_file)
