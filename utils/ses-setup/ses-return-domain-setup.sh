#!/bin/bash

set -euo pipefail

REGION="${REGION:-us-east-1}"
MAIL_PREFIX="${MAIL_PREFIX:-mailer}"
DOMAINS_FILE="${DOMAINS_FILE:-domains.txt}"

# Function to validate SES MAIL FROM configuration
validate_ses_mail_from() {
    local domain="$1"
    local mail_from_domain="$2"
    
    echo "Validating SES MAIL FROM configuration..."
    
    local mail_from_configured
    mail_from_configured=$(aws ses get-identity-mail-from-domain-attributes \
        --identities "$domain" \
        --region "$REGION" \
        --query "MailFromDomainAttributes.*.MailFromDomain" \
        --output text 2>/dev/null) || true
    
    # Handle "None" string output from AWS CLI
    if [[ "$mail_from_configured" == "None" || -z "$mail_from_configured" ]]; then
        mail_from_configured=""
    fi
    
    if [[ "$mail_from_configured" == "$mail_from_domain" ]]; then
        echo "  ✓ SES MAIL FROM domain correctly set to: $mail_from_domain"
        return 0
    else
        echo "  ✗ SES MAIL FROM domain validation FAILED"
        echo "    Expected: $mail_from_domain"
        echo "    Got: $mail_from_configured"
        return 1
    fi
}

# Function to validate MX record in Route53
validate_mx_record() {
    local mail_from_domain="$1"
    local hosted_zone_id="$2"
    
    echo "Validating MX record in Route53..."
    
    local mx_record
    mx_record=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --query "ResourceRecordSets[?Name=='$mail_from_domain.' && Type=='MX'].ResourceRecords[].Value" \
        --output text 2>/dev/null) || true
    
    # Handle "None" string output from AWS CLI
    if [[ "$mx_record" == "None" || -z "$mx_record" ]]; then
        mx_record=""
    fi
    
    local expected_value="10 feedback-smtp.$REGION.amazonses.com"
    if [[ "$mx_record" == *"$expected_value"* ]]; then
        echo "  ✓ MX record correctly configured: $mx_record"
        return 0
    else
        echo "  ✗ MX record validation FAILED"
        echo "    Expected: $expected_value"
        echo "    Got: $mx_record"
        return 1
    fi
}

# Function to validate TXT record in Route53
validate_txt_record() {
    local mail_from_domain="$1"
    local hosted_zone_id="$2"
    
    echo "Validating TXT record in Route53..."
    
    local txt_record
    txt_record=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --query "ResourceRecordSets[?Name=='$mail_from_domain.' && Type=='TXT'].ResourceRecords[].Value" \
        --output text 2>/dev/null) || true
    
    # Handle "None" string output from AWS CLI
    if [[ "$txt_record" == "None" || -z "$txt_record" ]]; then
        txt_record=""
    fi
    
    local expected_value="v=spf1 include:amazonses.com -all"
    if [[ "$txt_record" == *"$expected_value"* ]]; then
        echo "  ✓ TXT record correctly configured: $txt_record"
        return 0
    else
        echo "  ✗ TXT record validation FAILED"
        echo "    Expected: \"$expected_value\""
        echo "    Got: $txt_record"
        return 1
    fi
}

# Function to run all validations
run_validations() {
    local domain="$1"
    local mail_from_domain="$2"
    local hosted_zone_id="$3"
    local validation_passed=true
    
    echo ""
    echo "=== Running Validations for $domain ==="
    
    if ! validate_ses_mail_from "$domain" "$mail_from_domain"; then
        validation_passed=false
    fi
    
    if ! validate_mx_record "$mail_from_domain" "$hosted_zone_id"; then
        validation_passed=false
    fi
    
    if ! validate_txt_record "$mail_from_domain" "$hosted_zone_id"; then
        validation_passed=false
    fi
    
    echo ""
    if [[ "$validation_passed" == "true" ]]; then
        echo "=== All validations PASSED for $domain ==="
    else
        echo "=== Some validations FAILED for $domain ==="
    fi
    
    return 0
}

# Validate AWS credentials
echo "Validating AWS credentials..."
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "Error: AWS credentials not configured. Please run 'aws configure' or set credentials."
    exit 1
fi
echo "AWS credentials validated."

# Validate domains file exists
if [[ ! -f "$DOMAINS_FILE" ]]; then
    echo "Error: Domains file '$DOMAINS_FILE' not found."
    exit 1
fi

# Process each domain from the domains file
while IFS= read -r DOMAIN || [[ -n "$DOMAIN" ]]; do
    # Skip empty lines and comments
    [[ -z "$DOMAIN" || "$DOMAIN" =~ ^[[:space:]]*# ]] && continue
    
    # Trim whitespace
    DOMAIN=$(echo "$DOMAIN" | xargs)
    [[ -z "$DOMAIN" ]] && continue
    
    MAIL_FROM_DOMAIN="$MAIL_PREFIX.$DOMAIN"

    echo "----------------------------------------"
    echo "Configuring MAIL FROM for $DOMAIN"
    echo "MAIL FROM: $MAIL_FROM_DOMAIN"

    # Check if SES identity exists and is verified
    echo "Checking SES identity verification status..."
    VERIFICATION_STATUS=$(aws ses get-identity-verification-attributes \
        --identities "$DOMAIN" \
        --region "$REGION" \
        --query "VerificationAttributes.*.VerificationStatus" \
        --output text 2>/dev/null || echo "NotFound")
    
    # Handle "None" string output from AWS CLI when query returns null
    if [[ "$VERIFICATION_STATUS" == "None" || -z "$VERIFICATION_STATUS" ]]; then
        VERIFICATION_STATUS="NotFound"
    fi
    
    if [[ "$VERIFICATION_STATUS" != "Success" ]]; then
        echo "Warning: SES identity for $DOMAIN is not verified or doesn't exist. Status: $VERIFICATION_STATUS"
        echo "Please verify the domain in SES first."
        continue
    fi
    echo "SES identity verified."

    # 1. Configure SES MAIL FROM
    echo "Configuring SES MAIL FROM domain..."
    if ! aws ses set-identity-mail-from-domain \
        --identity "$DOMAIN" \
        --mail-from-domain "$MAIL_FROM_DOMAIN" \
        --behavior-on-mx-failure UseDefaultValue \
        --region "$REGION"; then
        echo "Error: Failed to configure SES MAIL FROM for $DOMAIN"
        continue
    fi

    # 2. Get hosted zone id
    echo "Looking up hosted zone for $DOMAIN..."
    HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
        --dns-name "$DOMAIN." \
        --query "HostedZones[0].Id" \
        --output text 2>/dev/null) || true

    if [[ -z "$HOSTED_ZONE_ID" || "$HOSTED_ZONE_ID" == "None" ]]; then
        echo "Error: Hosted zone for domain $DOMAIN not found in Route53."
        echo "Please ensure the domain is hosted on Route53."
        continue
    fi

    # Remove leading slash from hosted zone ID if present
    HOSTED_ZONE_ID=$(echo "$HOSTED_ZONE_ID" | sed 's/^\///')
    echo "Hosted Zone: $HOSTED_ZONE_ID"

    # 3. Create MX record
    cat > mx_record.json <<EOF
{
  "Comment": "SES MAIL FROM MX",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$MAIL_FROM_DOMAIN",
      "Type": "MX",
      "TTL": 300,
      "ResourceRecords": [{
        "Value": "10 feedback-smtp.$REGION.amazonses.com"
      }]
    }
  }]
}
EOF

    echo "Creating/updating MX record..."
    if ! aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch file://mx_record.json; then
        echo "Error: Failed to create MX record"
        rm -f mx_record.json txt_record.json
        continue
    fi
    echo "MX record created."

    # 4. Create SPF TXT record
    cat > txt_record.json <<EOF
{
  "Comment": "SES MAIL FROM SPF",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$MAIL_FROM_DOMAIN",
      "Type": "TXT",
      "TTL": 300,
      "ResourceRecords": [{
        "Value": "\"v=spf1 include:amazonses.com -all\""
      }]
    }
  }]
}
EOF

    echo "Creating/updating SPF TXT record..."
    if ! aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch file://txt_record.json; then
        echo "Error: Failed to create TXT record"
        rm -f mx_record.json txt_record.json
        continue
    fi
    echo "SPF TXT record created."

    # 5. Clean up temporary files
    rm -f mx_record.json txt_record.json

    # Wait for DNS propagation
    echo "Waiting for DNS propagation..."
    sleep 5
    
    # Run validations
    run_validations "$DOMAIN" "$MAIL_FROM_DOMAIN" "$HOSTED_ZONE_ID"

    echo "Completed: $DOMAIN"
    echo ""

done < "$DOMAINS_FILE"

echo "----------------------------------------"
echo "All domains processed."
