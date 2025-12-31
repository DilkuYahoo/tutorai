#!/bin/bash

# -----------------------------
# CONFIGURATION
# -----------------------------

# Hosted Zone ID for cognifylabs.ai (find via `aws route53 list-hosted-zones`)
HOSTED_ZONE_ID="Z02412413B7ILDEKU92G1"

# The domain or subdomain you want to receive email on
DOMAIN="advicegenie.com.au"

# SES region (replace with your SES inbound region)
SES_REGION="us-east-1"

# SES MX endpoint (format: "10 inbound-smtp.REGION.amazonaws.com")
MX_RECORD="10 inbound-smtp.${SES_REGION}.amazonaws.com"

# TTL for DNS record
TTL=300

# -----------------------------
# CREATE JSON CHANGE BATCH
# -----------------------------

CHANGE_BATCH=$(cat <<EOF
{
  "Comment": "Add MX record for AWS SES inbound",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}.",
        "Type": "MX",
        "TTL": ${TTL},
        "ResourceRecords": [
          {
            "Value": "${MX_RECORD}"
          }
        ]
      }
    }
  ]
}
EOF
)

# -----------------------------
# APPLY CHANGE
# -----------------------------

aws route53 change-resource-record-sets \
    --hosted-zone-id "$HOSTED_ZONE_ID" \
    --change-batch "$CHANGE_BATCH"

echo "MX record for ${DOMAIN} pointing to ${MX_RECORD} has been updated."
