#!/bin/bash

# ACM Certificate Decommissioning Script
# Deletes ACM certificate and cleans up Route53 DNS validation records
# Usage: ./decommission_acm.sh <certificate-arn> <acm-region> [route53-region]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check arguments
if [ $# -lt 2 ]; then
    log_error "Insufficient arguments provided"
    echo "Usage: $0 <certificate-arn> <acm-region> [route53-region]"
    echo "Example: $0 arn:aws:acm:ap-southeast-2:123456789012:certificate/abc123 ap-southeast-2 us-east-1"
    exit 1
fi

CERT_ARN="$1"
ACM_REGION="$2"
R53_REGION="${3:-us-east-1}"  # Route53 is global but API calls typically use us-east-1

log_info "Starting ACM certificate decommissioning process"
log_info "Certificate ARN: $CERT_ARN"
log_info "ACM Region: $ACM_REGION"
log_info "Route53 Region: $R53_REGION"

# Verify AWS CLI is installed
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

log_success "AWS CLI found"

# Check if certificate exists
log_info "Verifying certificate exists..."
if ! aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$ACM_REGION" &> /dev/null; then
    log_error "Certificate not found or you don't have permission to access it"
    exit 1
fi

log_success "Certificate found"

# Get certificate details
log_info "Fetching certificate details..."
CERT_DETAILS=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$ACM_REGION" \
    --output json)

DOMAIN_NAME=$(echo "$CERT_DETAILS" | jq -r '.Certificate.DomainName')
STATUS=$(echo "$CERT_DETAILS" | jq -r '.Certificate.Status')
VALIDATION_METHOD=$(echo "$CERT_DETAILS" | jq -r '.Certificate.DomainValidationOptions[0].ValidationMethod // "NONE"')

log_info "Domain Name: $DOMAIN_NAME"
log_info "Certificate Status: $STATUS"
log_info "Validation Method: $VALIDATION_METHOD"

# Check if certificate is in use
log_info "Checking if certificate is currently in use..."
IN_USE=$(echo "$CERT_DETAILS" | jq -r '.Certificate.InUseBy // [] | length')

if [ "$IN_USE" -gt 0 ]; then
    log_warning "Certificate is currently in use by $IN_USE resource(s):"
    echo "$CERT_DETAILS" | jq -r '.Certificate.InUseBy[]' | while read -r resource; do
        log_warning "  - $resource"
    done
    
    read -p "Do you want to continue? This may break services using this certificate (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Decommissioning cancelled by user"
        exit 0
    fi
else
    log_success "Certificate is not currently in use"
fi

# Extract DNS validation records if DNS validation was used
if [ "$VALIDATION_METHOD" == "DNS" ]; then
    log_info "DNS validation detected - will clean up validation records"
    
    # Get all domain validation options
    VALIDATION_OPTIONS=$(echo "$CERT_DETAILS" | jq -r '.Certificate.DomainValidationOptions[]')
    DOMAIN_COUNT=$(echo "$CERT_DETAILS" | jq -r '.Certificate.DomainValidationOptions | length')
    
    log_info "Found $DOMAIN_COUNT domain(s) to process"
    
    # Process each domain validation option
    echo "$CERT_DETAILS" | jq -c '.Certificate.DomainValidationOptions[]' | while read -r domain_validation; do
        VALIDATION_DOMAIN=$(echo "$domain_validation" | jq -r '.DomainName')
        RECORD_NAME=$(echo "$domain_validation" | jq -r '.ResourceRecord.Name // empty')
        RECORD_TYPE=$(echo "$domain_validation" | jq -r '.ResourceRecord.Type // empty')
        RECORD_VALUE=$(echo "$domain_validation" | jq -r '.ResourceRecord.Value // empty')
        
        if [ -z "$RECORD_NAME" ] || [ -z "$RECORD_TYPE" ] || [ -z "$RECORD_VALUE" ]; then
            log_warning "No DNS validation records found for domain: $VALIDATION_DOMAIN"
            continue
        fi
        
        log_info "Processing DNS validation record for: $VALIDATION_DOMAIN"
        log_info "  Record Name: $RECORD_NAME"
        log_info "  Record Type: $RECORD_TYPE"
        
        # Find the hosted zone
        log_info "Searching for hosted zone..."
        
        # Extract base domain from record name
        BASE_DOMAIN=$(echo "$VALIDATION_DOMAIN" | awk -F. '{print $(NF-1)"."$NF}')
        
        HOSTED_ZONES=$(aws route53 list-hosted-zones \
            --region "$R53_REGION" \
            --output json)
        
        ZONE_ID=""
        echo "$HOSTED_ZONES" | jq -c '.HostedZones[]' | while read -r zone; do
            ZONE_NAME=$(echo "$zone" | jq -r '.Name' | sed 's/\.$//')
            ZONE_ID_FULL=$(echo "$zone" | jq -r '.Id')
            
            if [[ "$RECORD_NAME" == *"$ZONE_NAME"* ]]; then
                ZONE_ID=$(echo "$ZONE_ID_FULL" | cut -d'/' -f3)
                log_success "Found matching hosted zone: $ZONE_NAME (ID: $ZONE_ID)"
                break
            fi
        done
        
        if [ -z "$ZONE_ID" ]; then
            log_warning "Could not find hosted zone for $RECORD_NAME - skipping DNS cleanup"
            continue
        fi
        
        # Check if record exists
        log_info "Checking if DNS record exists in hosted zone..."
        RECORD_EXISTS=$(aws route53 list-resource-record-sets \
            --hosted-zone-id "$ZONE_ID" \
            --region "$R53_REGION" \
            --output json | jq --arg name "$RECORD_NAME" --arg type "$RECORD_TYPE" \
            '.ResourceRecordSets[] | select(.Name == $name and .Type == $type)' | jq -s 'length')
        
        if [ "$RECORD_EXISTS" -eq 0 ]; then
            log_warning "DNS validation record not found in hosted zone - may have been already deleted"
            continue
        fi
        
        log_info "DNS validation record found - preparing to delete..."
        
        # Create change batch for deletion
        CHANGE_BATCH=$(cat <<EOF
{
  "Changes": [
    {
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "$RECORD_NAME",
        "Type": "$RECORD_TYPE",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$RECORD_VALUE"
          }
        ]
      }
    }
  ]
}
EOF
)
        
        log_info "Deleting DNS validation record from Route53..."
        CHANGE_INFO=$(aws route53 change-resource-record-sets \
            --hosted-zone-id "$ZONE_ID" \
            --region "$R53_REGION" \
            --change-batch "$CHANGE_BATCH" \
            --output json)
        
        CHANGE_ID=$(echo "$CHANGE_INFO" | jq -r '.ChangeInfo.Id' | cut -d'/' -f3)
        CHANGE_STATUS=$(echo "$CHANGE_INFO" | jq -r '.ChangeInfo.Status')
        
        log_success "DNS record deletion initiated (Change ID: $CHANGE_ID, Status: $CHANGE_STATUS)"
        
        # Wait for change to propagate
        log_info "Waiting for DNS change to propagate..."
        while true; do
            STATUS_CHECK=$(aws route53 get-change \
                --id "$CHANGE_ID" \
                --region "$R53_REGION" \
                --output json | jq -r '.ChangeInfo.Status')
            
            if [ "$STATUS_CHECK" == "INSYNC" ]; then
                log_success "DNS change propagated successfully"
                break
            fi
            
            log_info "Current status: $STATUS_CHECK - waiting 5 seconds..."
            sleep 5
        done
    done
else
    log_info "Certificate uses $VALIDATION_METHOD validation - no DNS cleanup required"
fi

# Delete the ACM certificate
log_info "Deleting ACM certificate..."

if aws acm delete-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$ACM_REGION"; then
    log_success "ACM certificate deleted successfully"
else
    log_error "Failed to delete ACM certificate"
    exit 1
fi

# Final verification
log_info "Verifying certificate deletion..."
sleep 2

if aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$ACM_REGION" &> /dev/null; then
    log_warning "Certificate still exists (may take a moment to fully delete)"
else
    log_success "Certificate no longer exists in ACM"
fi

log_success "========================================="
log_success "Certificate decommissioning completed!"
log_success "========================================="
log_info "Summary:"
log_info "  - Certificate ARN: $CERT_ARN"
log_info "  - Domain: $DOMAIN_NAME"
log_info "  - DNS validation records cleaned up from Route53"
log_info "  - Certificate deleted from ACM"