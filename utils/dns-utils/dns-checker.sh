#!/bin/bash

# Route53 DNS Validation Script
# Validates basic DNS entries and recommends fixes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check if dig is installed
if ! command -v dig &> /dev/null; then
    echo -e "${RED}Error: dig command is not installed${NC}"
    exit 1
fi

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

# Function to validate A records (including Alias records)
validate_a_record() {
    local zone_id=$1
    local record_name=$2
    local record_type=$3
    
    echo -e "${YELLOW}Checking A record: $record_name${NC}"
    
    # Get full record details from Route53
    record_details=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$zone_id" \
        --query "ResourceRecordSets[?Name=='$record_name.' && Type=='A']" \
        --output json)
    
    # Check if it's an Alias record
    is_alias=$(echo "$record_details" | jq -r '.[0].AliasTarget // empty')
    
    # Query actual DNS
    actual_ips=$(dig +short "$record_name")
    
    if [ -z "$actual_ips" ]; then
        echo -e "${RED}✗ DNS resolution failed${NC}"
        echo -e "  Recommendation: Check if nameservers are correctly configured"
        return 1
    fi
    
    first_ip=$(echo "$actual_ips" | head -n 1)
    
    if [ -n "$is_alias" ]; then
        # Handle Alias record
        alias_target=$(echo "$record_details" | jq -r '.[0].AliasTarget.DNSName')
        alias_target="${alias_target%.}"  # Remove trailing dot
        alias_hosted_zone=$(echo "$record_details" | jq -r '.[0].AliasTarget.HostedZoneId')
        
        echo -e "${BLUE}  Type: Alias Record${NC}"
        echo -e "  Target: $alias_target"
        echo -e "  Hosted Zone ID: $alias_hosted_zone"
        
        # Determine the AWS service type
        service_type="Unknown"
        if [[ "$alias_target" == *"cloudfront.net"* ]]; then
            service_type="CloudFront Distribution"
        elif [[ "$alias_target" == *"elb.amazonaws.com"* ]] || [[ "$alias_target" == *"elasticloadbalancing"* ]]; then
            service_type="Elastic Load Balancer"
        elif [[ "$alias_target" == *"s3-website"* ]]; then
            service_type="S3 Website"
        elif [[ "$alias_target" == *"execute-api"* ]]; then
            service_type="API Gateway"
        fi
        
        echo -e "  Service: ${BLUE}$service_type${NC}"
        
        # Verify DNS resolution
        echo -e "${GREEN}✓ Alias record resolves to: $first_ip${NC}"
        
        # Additional IPs if multiple (common with CloudFront)
        ip_count=$(echo "$actual_ips" | wc -l)
        if [ "$ip_count" -gt 1 ]; then
            echo -e "  Multiple IPs detected (${ip_count} total - normal for CloudFront/ALB)"
        fi
        
        # Verify the alias target itself resolves
        target_ip=$(dig +short "$alias_target" | head -n 1)
        if [ -z "$target_ip" ]; then
            echo -e "${RED}✗ Alias target does not resolve${NC}"
            echo -e "  Recommendation: Check if the target resource exists and is healthy"
        else
            echo -e "${GREEN}✓ Alias target is healthy and resolving${NC}"
        fi
        
        # CloudFront specific checks
        if [[ "$service_type" == "CloudFront Distribution" ]]; then
            # Extract distribution ID from target
            dist_id=$(echo "$alias_target" | cut -d'.' -f1)
            
            # Try to get CloudFront distribution status
            cf_status=$(aws cloudfront get-distribution --id "$dist_id" \
                --query 'Distribution.Status' --output text 2>/dev/null || echo "Unable to fetch")
            
            if [ "$cf_status" != "Unable to fetch" ]; then
                if [ "$cf_status" == "Deployed" ]; then
                    echo -e "${GREEN}✓ CloudFront distribution status: $cf_status${NC}"
                else
                    echo -e "${YELLOW}⚠ CloudFront distribution status: $cf_status${NC}"
                    echo -e "  Recommendation: Wait for distribution to deploy"
                fi
            fi
        fi
        
    else
        # Handle standard A record
        record_value=$(echo "$record_details" | jq -r '.[0].ResourceRecords[0].Value')
        
        echo -e "${BLUE}  Type: Standard A Record${NC}"
        
        if [ "$first_ip" == "$record_value" ]; then
            echo -e "${GREEN}✓ A record resolves correctly to $first_ip${NC}"
        else
            echo -e "${RED}✗ Mismatch detected${NC}"
            echo -e "  Expected: $record_value"
            echo -e "  Actual:   $first_ip"
            echo -e "  Recommendation: Update Route53 record or check DNS propagation"
        fi
    fi
}

# Function to validate MX records
validate_mx_record() {
    local record_name=$1
    
    echo -e "${YELLOW}Checking MX records: $record_name${NC}"
    
    mx_records=$(dig +short MX "$record_name")
    
    if [ -z "$mx_records" ]; then
        echo -e "${RED}✗ No MX records found${NC}"
        echo -e "  Recommendation: Add MX records for email delivery"
        return 1
    fi
    
    echo -e "${GREEN}✓ MX records found:${NC}"
    echo "$mx_records" | while read -r line; do
        echo "  $line"
    done
    
    # Check for common issues
    if echo "$mx_records" | grep -q "0 \."; then
        echo -e "${RED}✗ Null MX record detected (0 .)${NC}"
        echo -e "  Recommendation: This explicitly rejects all email. Remove if unintended."
    fi
}

# Function to validate TXT/SPF records
validate_spf_record() {
    local record_name=$1
    
    echo -e "${YELLOW}Checking SPF record: $record_name${NC}"
    
    spf_record=$(dig +short TXT "$record_name" | grep "v=spf1")
    
    if [ -z "$spf_record" ]; then
        echo -e "${RED}✗ No SPF record found${NC}"
        echo -e "  Recommendation: Add SPF record to prevent email spoofing"
        echo -e "  Example: \"v=spf1 include:_spf.google.com ~all\""
        return 1
    fi
    
    echo -e "${GREEN}✓ SPF record found: $spf_record${NC}"
    
    # Check for multiple SPF records
    spf_count=$(dig +short TXT "$record_name" | grep -c "v=spf1")
    if [ "$spf_count" -gt 1 ]; then
        echo -e "${RED}✗ Multiple SPF records detected${NC}"
        echo -e "  Recommendation: Consolidate into a single SPF record"
    fi
    
    # Check for missing all mechanism
    if ! echo "$spf_record" | grep -qE "[\+\-\~\?]all"; then
        echo -e "${YELLOW}⚠ SPF record missing 'all' mechanism${NC}"
        echo -e "  Recommendation: Add ~all or -all to the end of SPF record"
    fi
}

# Function to validate DMARC record
validate_dmarc_record() {
    local domain=$1
    local dmarc_domain="_dmarc.$domain"
    
    echo -e "${YELLOW}Checking DMARC record: $dmarc_domain${NC}"
    
    dmarc_record=$(dig +short TXT "$dmarc_domain" | grep "v=DMARC1")
    
    if [ -z "$dmarc_record" ]; then
        echo -e "${RED}✗ No DMARC record found${NC}"
        echo -e "  Recommendation: Add DMARC record for email authentication"
        echo -e "  Example: \"v=DMARC1; p=quarantine; rua=mailto:dmarc@$domain\""
        return 1
    fi
    
    echo -e "${GREEN}✓ DMARC record found: $dmarc_record${NC}"
    
    # Check policy
    if echo "$dmarc_record" | grep -q "p=none"; then
        echo -e "${YELLOW}⚠ DMARC policy is set to 'none' (monitoring only)${NC}"
        echo -e "  Recommendation: Consider upgrading to 'quarantine' or 'reject'"
    fi
}

# Function to validate www CNAME redirect
validate_www_cname() {
    local domain=$1
    local www_domain="www.$domain"
    
    echo -e "${YELLOW}Checking www CNAME: $www_domain${NC}"
    
    # Check if www subdomain exists in Route53
    cname_record=$(dig +short CNAME "$www_domain")
    a_record=$(dig +short A "$www_domain")
    
    if [ -z "$cname_record" ] && [ -z "$a_record" ]; then
        echo -e "${RED}✗ No www record found${NC}"
        echo -e "  Recommendation: Add CNAME record for www.$domain pointing to $domain"
        echo -e "  AWS CLI command:"
        echo -e "    Create a CNAME record set in Route53 console or use:"
        echo -e "    www.$domain -> $domain (CNAME)"
        return 1
    fi
    
    if [ -n "$cname_record" ]; then
        # Remove trailing dot from CNAME target
        cname_target="${cname_record%.}"
        
        if [ "$cname_target" == "$domain" ]; then
            echo -e "${GREEN}✓ www CNAME correctly points to $domain${NC}"
            
            # Verify www actually resolves to the same IP as apex
            apex_ip=$(dig +short A "$domain" | head -n 1)
            www_ip=$(dig +short A "$www_domain" | head -n 1)
            
            if [ "$apex_ip" == "$www_ip" ]; then
                echo -e "${GREEN}✓ www and apex domain resolve to same IP: $apex_ip${NC}"
            else
                echo -e "${YELLOW}⚠ www and apex resolve to different IPs${NC}"
                echo -e "  Apex: $apex_ip"
                echo -e "  www:  $www_ip"
                echo -e "  Recommendation: Verify this is intentional"
            fi
        else
            echo -e "${YELLOW}⚠ www CNAME points to: $cname_target${NC}"
            echo -e "  Expected: $domain"
            echo -e "  Recommendation: Update CNAME if this is not intentional"
        fi
    elif [ -n "$a_record" ]; then
        echo -e "${YELLOW}⚠ www has an A record instead of CNAME: $a_record${NC}"
        echo -e "  Recommendation: Consider using CNAME for easier management"
        echo -e "  Note: A record works but CNAME is more flexible"
        
        # Check if it matches apex
        apex_ip=$(dig +short A "$domain" | head -n 1)
        if [ "$a_record" == "$apex_ip" ]; then
            echo -e "${GREEN}✓ www A record matches apex domain IP${NC}"
        else
            echo -e "${YELLOW}⚠ www and apex resolve to different IPs${NC}"
            echo -e "  Apex: $apex_ip"
            echo -e "  www:  $a_record"
        fi
    fi
    
    # Test HTTP redirect (optional, requires curl)
    if command -v curl &> /dev/null; then
        # Try to check if there's an HTTP redirect from www to non-www
        http_status=$(curl -s -o /dev/null -w "%{http_code}" -L "http://$www_domain" --max-time 5 2>/dev/null || echo "000")
        
        if [ "$http_status" != "000" ]; then
            final_url=$(curl -s -o /dev/null -w "%{url_effective}" -L "http://$www_domain" --max-time 5 2>/dev/null || echo "")
            
            if [[ "$final_url" == *"$domain"* ]] && [[ "$final_url" != *"www."* ]]; then
                echo -e "${GREEN}✓ HTTP redirect from www to apex is configured${NC}"
            fi
        fi
    fi
}

# Function to validate NS records
validate_ns_records() {
    local domain=$1
    
    echo -e "${YELLOW}Checking NS records: $domain${NC}"
    
    # Get NS records from Route53
    r53_ns=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='$domain.'].DelegationSet.NameServers[]" --output text 2>/dev/null)
    
    # Get actual NS records
    actual_ns=$(dig +short NS "$domain")
    
    if [ -z "$actual_ns" ]; then
        echo -e "${RED}✗ No NS records found in DNS${NC}"
        echo -e "  Recommendation: Verify domain registrar nameserver configuration"
        return 1
    fi
    
    echo -e "${GREEN}✓ NS records found:${NC}"
    echo "$actual_ns" | while read -r line; do
        echo "  $line"
    done
    
    if [ -n "$r53_ns" ]; then
        echo -e "\n${BLUE}Route53 Nameservers:${NC}"
        echo "$r53_ns" | tr '\t' '\n' | while read -r line; do
            echo "  $line"
        done
    fi
}

# Function to check TTL values
check_ttl_values() {
    local zone_id=$1
    local record_name=$2
    local record_type=$3
    
    ttl=$(aws route53 list-resource-record-sets \
        --hosted-zone-id "$zone_id" \
        --query "ResourceRecordSets[?Name=='$record_name.' && Type=='$record_type'].TTL | [0]" \
        --output text)
    
    if [ "$ttl" != "None" ] && [ -n "$ttl" ]; then
        if [ "$ttl" -lt 300 ]; then
            echo -e "${YELLOW}⚠ Low TTL value: ${ttl}s${NC}"
            echo -e "  Recommendation: Consider increasing TTL to reduce DNS query load"
        elif [ "$ttl" -gt 86400 ]; then
            echo -e "${YELLOW}⚠ High TTL value: ${ttl}s${NC}"
            echo -e "  Recommendation: High TTL delays propagation of changes"
        else
            echo -e "${GREEN}✓ TTL value is reasonable: ${ttl}s${NC}"
        fi
    fi
}

# Main script
print_header "Route53 DNS Validation Report"

# Get list of hosted zones
echo "Fetching hosted zones..."
zones=$(aws route53 list-hosted-zones --query 'HostedZones[*].[Id,Name]' --output text)

if [ -z "$zones" ]; then
    echo -e "${RED}No hosted zones found${NC}"
    exit 1
fi

# Process each zone
while IFS=$'\t' read -r zone_id zone_name; do
    # Remove trailing dot
    domain="${zone_name%.}"
    
    print_header "Domain: $domain"
    
    # Validate NS records first
    validate_ns_records "$domain"
    
    # Get all records for the zone
    records=$(aws route53 list-resource-record-sets --hosted-zone-id "$zone_id" --output json)
    
    # Check A records (both standard and Alias)
    echo "$records" | jq -r '.ResourceRecordSets[] | select(.Type=="A") | .Name' | while read -r name; do
        # Remove trailing dot
        name="${name%.}"
        validate_a_record "$zone_id" "$name" "A"
        check_ttl_values "$zone_id" "$name" "A"
    done
    
    # Check MX records
    if echo "$records" | jq -e '.ResourceRecordSets[] | select(.Type=="MX")' > /dev/null 2>&1; then
        validate_mx_record "$domain"
    else
        echo -e "\n${YELLOW}⚠ No MX records configured${NC}"
    fi
    
    # Check SPF
    validate_spf_record "$domain"
    
    # Check DMARC
    validate_dmarc_record "$domain"
    
    # Check www CNAME redirect
    validate_www_cname "$domain"
    
    echo ""
    
done <<< "$zones"

print_header "Validation Complete"

echo -e "${BLUE}Summary of Recommendations:${NC}"
echo "1. Ensure all nameservers match between Route53 and your domain registrar"
echo "2. Configure SPF records to prevent email spoofing"
echo "3. Add DMARC records for email authentication and reporting"
echo "4. Review TTL values based on your change frequency needs"
echo "5. Verify all DNS records resolve correctly using dig or nslookup"
echo "6. Set up www CNAME to redirect to your apex domain"
echo "7. Consider configuring HTTP/HTTPS redirects at application level"
echo ""
echo -e "${GREEN}For more details, review the output above.${NC}"