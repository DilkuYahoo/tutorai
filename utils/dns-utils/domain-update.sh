#!/bin/bash

# Route 53 DNS Record Upsert Script
# This script creates or updates basic DNS records in AWS Route 53

set -e

# Configuration
DOMAIN_NAME="${1}"
IP_ADDRESS="${2}"
HOSTED_ZONE_ID="${3}"

# Validate inputs
if [ -z "$DOMAIN_NAME" ] || [ -z "$IP_ADDRESS" ] || [ -z "$HOSTED_ZONE_ID" ]; then
    echo "Usage: $0 <domain-name> <ip-address> <hosted-zone-id>"
    echo "Example: $0 example.com 54.123.45.67 Z1234567890ABC"
    exit 1
fi

# Validate IP address format
if ! [[ $IP_ADDRESS =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    echo "Error: Invalid IP address format"
    exit 1
fi

echo "Upserting DNS records for $DOMAIN_NAME with IP $IP_ADDRESS"
echo "Hosted Zone ID: $HOSTED_ZONE_ID"
echo ""

# Function to upsert A record
upsert_a_record() {
    local record_name=$1
    local ip=$2
    
    echo "Upserting A record: $record_name -> $ip"
    
    cat > /tmp/route53-change-batch.json <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$record_name",
        "Type": "A",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$ip"
          }
        ]
      }
    }
  ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch file:///tmp/route53-change-batch.json
    
    echo "✓ Successfully upserted $record_name"
    echo ""
}

# Function to upsert CNAME record
upsert_cname_record() {
    local record_name=$1
    local target=$2
    
    echo "Upserting CNAME record: $record_name -> $target"
    
    cat > /tmp/route53-change-batch.json <<EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "$record_name",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$target"
          }
        ]
      }
    }
  ]
}
EOF

    aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch file:///tmp/route53-change-batch.json
    
    echo "✓ Successfully upserted $record_name"
    echo ""
}

# Upsert root domain A record
upsert_a_record "$DOMAIN_NAME" "$IP_ADDRESS"

# Upsert www subdomain CNAME to root domain
upsert_cname_record "www.$DOMAIN_NAME" "$DOMAIN_NAME"

# Optional: Upsert additional common subdomains
# Uncomment the lines below if you want these records

# Mail subdomain (if you have a mail server)
# upsert_a_record "mail.$DOMAIN_NAME" "$IP_ADDRESS"

# FTP subdomain
# upsert_a_record "ftp.$DOMAIN_NAME" "$IP_ADDRESS"

# API subdomain
# upsert_a_record "api.$DOMAIN_NAME" "$IP_ADDRESS"

echo "========================================"
echo "DNS records upserted successfully!"
echo "========================================"
echo ""
echo "Note: DNS changes may take a few minutes to propagate."
echo "You can check the status with:"
echo "  dig $DOMAIN_NAME"
echo "  dig www.$DOMAIN_NAME"

# Cleanup
rm -f /tmp/route53-change-batch.json