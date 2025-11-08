#!/bin/bash

# --- Configuration Constants ---
DOMAIN_NAME="cognifylabs.ai"
SES_REGION="us-east-1"  # SES Identity will be created in N. Virginia
R53_REGION="ap-southeast-2" # General region for other AWS operations, Route 53 is global.
DNS_TTL=1800 # TTL for DNS records (30 minutes)

# Required tool check
if ! command -v jq &> /dev/null
then
    echo "Error: 'jq' is required for JSON processing but could not be found."
    echo "Please install jq (e.g., 'sudo apt-get install jq' or 'brew install jq')."
    exit 1
fi

echo "Starting SES setup for domain: ${DOMAIN_NAME}"
echo "SES Identity Region: ${SES_REGION}"

# --- 1. Find the Route 53 Hosted Zone ID ---
echo -e "\n[R53] Searching for Hosted Zone ID..."

# Use a specific query to find the exact zone for the domain name
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --dns-name "${DOMAIN_NAME}." \
    --query "HostedZones[?Name == \`${DOMAIN_NAME}.\`].Id" \
    --output text \
    --region "${R53_REGION}" 2>/dev/null)

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo "Error: Hosted Zone for '${DOMAIN_NAME}' not found in Route 53."
    exit 1
fi

# Clean up the ID format from /hostedzone/ZXXXXXXXXXX to ZXXXXXXXXXX
HOSTED_ZONE_ID=$(echo "$HOSTED_ZONE_ID" | sed 's/\/hostedzone\///')
echo "[R53] Found Hosted Zone ID: ${HOSTED_ZONE_ID}"

# --- 2. Create SES Identity and get tokens (in us-east-1) ---
echo -e "\n[SES] Connecting to SES in region: ${SES_REGION}..."

# Get Domain Verification TXT Token
echo "[SES] Creating/Verifying Domain Identity..."
VERIFICATION_TOKEN=$(aws ses verify-domain-identity \
    --domain "${DOMAIN_NAME}" \
    --region "${SES_REGION}" \
    --query "VerificationToken" \
    --output text 2>/dev/null)

if [ -z "$VERIFICATION_TOKEN" ]; then
    echo "Error: Failed to retrieve SES Verification Token."
    exit 1
fi
echo "[SES] Verification Token (TXT Value): ${VERIFICATION_TOKEN}"

# Get Easy DKIM CNAME Tokens (The output is JSON for easy processing)
echo "[SES] Requesting Easy DKIM tokens..."
DKIM_TOKENS_JSON=$(aws ses verify-domain-dkim \
    --domain "${DOMAIN_NAME}" \
    --region "${SES_REGION}" \
    --query "DkimTokens" \
    --output json 2>/dev/null)

# Convert DKIM tokens JSON array into a bash array
DKIM_TOKENS=($(echo "$DKIM_TOKENS_JSON" | jq -r '.[]'))
if [ ${#DKIM_TOKENS[@]} -ne 3 ]; then
    echo "Error: Expected 3 DKIM tokens, received ${#DKIM_TOKENS[@]}."
    exit 1
fi
echo "[SES] Easy DKIM Tokens: ${DKIM_TOKENS[@]}"

# --- 3. Construct the DNS Change Batch JSON for UPSERT ---
echo -e "\n[R53] Constructing DNS Change Batch JSON..."

# Start the JSON structure
CHANGES_JSON_HEADER='{
  "Comment": "SES Verification and Easy DKIM for '"${DOMAIN_NAME}"' in '"${SES_REGION}"'",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_amazonses.'$DOMAIN_NAME'.",
        "Type": "TXT",
        "TTL": '$DNS_TTL',
        "ResourceRecords": [
          { "Value": "\"'$VERIFICATION_TOKEN'\"" }
        ]
      }
    }'

CHANGES_JSON_BODY=""
DKIM_HOST="dkim.amazonses.com"

# Loop through the DKIM tokens to create 3 CNAME records
for TOKEN in "${DKIM_TOKENS[@]}"; do
    CHANGES_JSON_BODY+=",
    {
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"${TOKEN}._domainkey.${DOMAIN_NAME}.\",
        \"Type\": \"CNAME\",
        \"TTL\": ${DNS_TTL},
        \"ResourceRecords\": [
          { \"Value\": \"${TOKEN}.${DKIM_HOST}\" }
        ]
      }
    }"
done

CHANGES_JSON_FOOTER='
  ]
}'

# Combine and save to a temporary file
JSON_PAYLOAD=$(echo "${CHANGES_JSON_HEADER}${CHANGES_JSON_BODY}${CHANGES_JSON_FOOTER}")
TMP_FILE=$(mktemp)
echo "$JSON_PAYLOAD" > "$TMP_FILE"

echo "--- DNS Records to be UPSERTED (Check ${TMP_FILE}) ---"
echo "$JSON_PAYLOAD" | jq -r '.Changes[] | "ACTION: \(.Action) | TYPE: \(.ResourceRecordSet.Type) | NAME: \(.ResourceRecordSet.Name) | VALUE: \(.ResourceRecordSet.ResourceRecords[0].Value)"'
echo "------------------------------------------------------"


# --- 4. Apply changes to Route 53 ---
echo -e "\n[R53] Applying DNS changes (UPSERT) to Route 53..."

ROUTE53_RESPONSE=$(aws route53 change-resource-record-sets \
    --hosted-zone-id "${HOSTED_ZONE_ID}" \
    --change-batch file://"$TMP_FILE" \
    --region "${R53_REGION}")

if [ $? -ne 0 ]; then
    echo "Error: Failed to apply Route 53 changes."
    rm "$TMP_FILE"
    exit 1
fi

CHANGE_ID=$(echo "$ROUTE53_RESPONSE" | jq -r '.ChangeInfo.Id')
echo "[R53] DNS changes initiated successfully."
echo "[R53] Change ID: ${CHANGE_ID}"

# Poll for completion (optional but recommended)
echo "[R53] Waiting for change to synchronize (this may take a moment)..."
aws route53 wait resource-record-sets-changed --id "${CHANGE_ID}" --region "${R53_REGION}"
rm "$TMP_FILE"

echo -e "\n✅ Setup Complete for ${DOMAIN_NAME}!"
echo "The SES identity and DKIM records have been created in ${SES_REGION}"
echo "and the corresponding DNS records have been UPSERTED in Route 53."
echo "Verification status should update automatically in SES within minutes."