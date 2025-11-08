#!/bin/bash

# Route 53 DNS Record Upsert Script
# Updates or creates a CNAME record for api.cognifylabs.ai

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
DOMAIN="api.cognifylabs.ai"
TARGET="t2n4m8126c.execute-api.ap-southeast-2.amazonaws.com"
ZONE_NAME="cognifylabs.ai"
TTL=300
REGION="ap-southeast-2"

log_info "Starting Route 53 DNS record upsert process"
echo "========================================"
log_info "Domain: ${DOMAIN}"
log_info "Target: ${TARGET}"
log_info "Zone: ${ZONE_NAME}"
log_info "TTL: ${TTL} seconds"
log_info "Region: ${REGION}"
echo "========================================"
echo ""

# Check AWS CLI installation
log_info "Checking AWS CLI installation..."
if ! command -v aws &> /dev/null; then
  log_error "AWS CLI is not installed or not in PATH"
  log_error "Please install AWS CLI: https://aws.amazon.com/cli/"
  exit 1
fi
AWS_VERSION=$(aws --version 2>&1 | head -n1)
log_success "AWS CLI found: ${AWS_VERSION}"
echo ""

# Check AWS credentials
log_info "Verifying AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
  log_error "AWS credentials are not configured or are invalid"
  log_error "Please run 'aws configure' to set up your credentials"
  exit 1
fi
CALLER_IDENTITY=$(aws sts get-caller-identity --output json)
ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | grep -o '"Account": "[^"]*"' | cut -d'"' -f4)
USER_ARN=$(echo "$CALLER_IDENTITY" | grep -o '"Arn": "[^"]*"' | cut -d'"' -f4)
log_success "AWS credentials verified"
log_info "Account ID: ${ACCOUNT_ID}"
log_info "User/Role: ${USER_ARN}"
echo ""

# Get the hosted zone ID
log_info "Searching for hosted zone '${ZONE_NAME}'..."
ZONE_RESPONSE=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${ZONE_NAME}" \
  --output json 2>&1) || {
  log_error "Failed to query Route 53 hosted zones"
  log_error "Response: ${ZONE_RESPONSE}"
  exit 1
}

ZONE_ID=$(echo "$ZONE_RESPONSE" | \
  grep -o '"Id": "/hostedzone/[^"]*"' | \
  head -n1 | \
  cut -d'/' -f3 | \
  tr -d '"')

if [ -z "$ZONE_ID" ]; then
  log_error "Could not find hosted zone for '${ZONE_NAME}'"
  log_info "Available zones:"
  aws route53 list-hosted-zones --query 'HostedZones[*].[Name,Id]' --output table
  exit 1
fi

log_success "Found hosted zone"
log_info "Zone ID: ${ZONE_ID}"
echo ""

# Check existing DNS records
log_info "Checking for existing DNS record..."
EXISTING_RECORD=$(aws route53 list-resource-record-sets \
  --hosted-zone-id "${ZONE_ID}" \
  --query "ResourceRecordSets[?Name=='${DOMAIN}.']" \
  --output json 2>&1) || {
  log_warning "Could not check existing records (non-fatal)"
}

if echo "$EXISTING_RECORD" | grep -q "\"Name\": \"${DOMAIN}.\""; then
  log_warning "Existing record found - will be updated"
  echo "$EXISTING_RECORD" | grep -A5 "\"Name\": \"${DOMAIN}.\""
else
  log_info "No existing record found - will create new record"
fi
echo ""

# Create the change batch JSON
log_info "Preparing change batch..."
CHANGE_BATCH=$(cat <<EOF
{
  "Comment": "Upsert CNAME record for ${DOMAIN} at $(date -u +"%Y-%m-%d %H:%M:%S UTC")",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}",
        "Type": "CNAME",
        "TTL": ${TTL},
        "ResourceRecords": [
          {
            "Value": "${TARGET}"
          }
        ]
      }
    }
  ]
}
EOF
)

log_info "Change batch JSON:"
echo "$CHANGE_BATCH"
echo ""

# Apply the change
log_info "Submitting DNS record change to Route 53..."
CHANGE_RESPONSE=$(aws route53 change-resource-record-sets \
  --hosted-zone-id "${ZONE_ID}" \
  --change-batch "${CHANGE_BATCH}" \
  --output json 2>&1) || {
  log_error "Failed to update DNS record"
  log_error "Response: ${CHANGE_RESPONSE}"
  exit 1
}

CHANGE_ID=$(echo "$CHANGE_RESPONSE" | grep -o '"Id": "[^"]*"' | head -n1 | cut -d'"' -f4)
CHANGE_STATUS=$(echo "$CHANGE_RESPONSE" | grep -o '"Status": "[^"]*"' | head -n1 | cut -d'"' -f4)

log_success "DNS record change submitted successfully!"
log_info "Change ID: ${CHANGE_ID}"
log_info "Status: ${CHANGE_STATUS}"
echo ""

# Summary
echo "========================================"
log_success "DNS UPDATE COMPLETE"
echo "========================================"
log_info "Record: ${DOMAIN}"
log_info "Type: CNAME"
log_info "Target: ${TARGET}"
log_info "TTL: ${TTL} seconds"
echo ""

# Check change status
log_info "Checking propagation status..."
for i in {1..3}; do
  sleep 2
  STATUS_CHECK=$(aws route53 get-change --id "${CHANGE_ID}" --query 'ChangeInfo.Status' --output text 2>&1) || {
    log_warning "Could not check status"
    break
  }
  log_info "Status check ${i}/3: ${STATUS_CHECK}"
  if [ "$STATUS_CHECK" = "INSYNC" ]; then
    log_success "DNS changes have propagated!"
    break
  fi
done
echo ""

log_warning "Note: DNS propagation may take several minutes globally"
log_info "You can monitor the change status with:"
echo "  aws route53 get-change --id ${CHANGE_ID}"
echo ""
log_info "Test DNS resolution with:"
echo "  dig ${DOMAIN}"
echo "  nslookup ${DOMAIN}"
echo ""
log_success "Script completed successfully!"