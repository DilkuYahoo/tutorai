#!/bin/bash

set -e

# -----------------------------
# CONFIGURATION
# -----------------------------
DOMAIN="${DOMAIN:-advicegenie.com.au}"
SUBDOMAIN="${SUBDOMAIN:-ba.advicegenie.com.au}"
REGION="${REGION:-us-east-1}"
S3_REGION="${S3_REGION:-ap-southeast-2}"
S3_BUCKET="${S3_BUCKET:-www.advicegenie.com.au}"
PREFIX="${PREFIX:-ba}"

echo "Starting deployment for $SUBDOMAIN"

# -----------------------------
# 1. FIND ACM CERTIFICATE
# -----------------------------

echo "Searching for ACM certificate..."

CERT_ARN=$(aws acm list-certificates \
  --region $REGION \
  --query "CertificateSummaryList[?DomainName=='$DOMAIN'].CertificateArn" \
  --output text)

if [ -z "$CERT_ARN" ]; then
  echo "No certificate found for $DOMAIN. Requesting new one..."

  CERT_ARN=$(aws acm request-certificate \
    --domain-name $DOMAIN \
    --subject-alternative-names "*.$DOMAIN" \
    --validation-method DNS \
    --region $REGION \
    --query CertificateArn \
    --output text)

  echo "New certificate requested: $CERT_ARN"
else
  echo "Found certificate: $CERT_ARN"
fi

# -----------------------------
# 2. VALIDATE CERTIFICATE DOMAINS
# -----------------------------

echo "Checking certificate SAN list..."

SAN_LIST=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $REGION \
  --query "Certificate.SubjectAlternativeNames[]" \
  --output text)

echo "Current certificate SANs: $SAN_LIST"

# Check if wildcard or subdomain is covered
WILDCARD="*.$DOMAIN"
if echo "$SAN_LIST" | grep -q "$WILDCARD" || echo "$SAN_LIST" | grep -q "$SUBDOMAIN"; then
  echo "Certificate covers $SUBDOMAIN"
else
  echo "Certificate does not cover $SUBDOMAIN"
  echo "Requesting new wildcard certificate..."
  
  # Request new certificate with wildcard
  CERT_ARN=$(aws acm request-certificate \
    --domain-name $DOMAIN \
    --subject-alternative-names "*.$DOMAIN" \
    --validation-method DNS \
    --region $REGION \
    --query CertificateArn \
    --output text)
  
  echo "New wildcard certificate requested: $CERT_ARN"
  
  # Wait for certificate to be issued
  echo "Waiting for certificate to be issued..."
  while true; do
    STATUS=$(aws acm describe-certificate \
      --certificate-arn $CERT_ARN \
      --region $REGION \
      --query "Certificate.Status" \
      --output text)
    
    echo "Certificate status: $STATUS"
    
    if [ "$STATUS" = "ISSUED" ]; then
      break
    fi
    
    if [ "$STATUS" = "FAILED" ]; then
      echo "ERROR: Certificate validation failed"
      exit 1
    fi
    
    echo "Waiting 10 seconds for certificate validation..."
    sleep 10
  done
  
  echo "Certificate issued successfully"
fi

STATUS=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $REGION \
  --query "Certificate.Status" \
  --output text)

echo "Certificate status: $STATUS"

if [ "$STATUS" != "ISSUED" ]; then
  echo "ERROR: Certificate not issued. Exiting."
  exit 1
fi

# -----------------------------
# 3. FIND CLOUDFRONT DISTRIBUTION
# -----------------------------

echo "Locating CloudFront distribution..."

DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?contains(@,'$DOMAIN')]].Id" \
  --output text)

if [ -z "$DIST_ID" ]; then
  echo "ERROR: Could not find CloudFront distribution for $DOMAIN"
  exit 1
fi

echo "CloudFront distribution found: $DIST_ID"

# -----------------------------
# 3B. CONFIGURE S3 BUCKET (if specified)
# -----------------------------

if [ -n "$S3_BUCKET" ]; then
  echo "Configuring S3 bucket: $S3_BUCKET in $S3_REGION"
  
  # Enable static website hosting
  aws s3 website s3://$S3_BUCKET \
    --index-document index.html \
    --error-document error.html \
    --region $S3_REGION 2>/dev/null || true
  
  # Get S3 website endpoint
  S3_WEBSITE_ENDPOINT="$S3_BUCKET.s3-website-$S3_REGION.amazonaws.com"
  echo "S3 website endpoint: $S3_WEBSITE_ENDPOINT"
  
  # Get S3 bucket ARN for CloudFront origin
  S3_ORIGIN="$S3_BUCKET.s3.$S3_REGION.amazonaws.com"
  echo "S3 origin for CloudFront: $S3_ORIGIN"
else
  echo "No S3 bucket specified, using existing CloudFront origin"
fi

# -----------------------------
# 4. GET CURRENT CONFIG
# -----------------------------

ETAG=$(aws cloudfront get-distribution-config \
  --id $DIST_ID \
  --query "ETag" \
  --output text)

aws cloudfront get-distribution-config \
  --id $DIST_ID \
  --query "DistributionConfig" > cf-config.json

# -----------------------------
# 5. ADD SUBDOMAIN ALIAS AND CERTIFICATE
# -----------------------------

echo "Checking if alias already exists..."

EXISTS=$(jq ".Aliases.Items[] | select(.==\"$SUBDOMAIN\")" cf-config.json || true)

if [ -z "$EXISTS" ]; then

  echo "Adding alias $SUBDOMAIN"

  # Get the certificate ARN from ACM for the domain
  echo "Updating CloudFront to use ACM certificate..."

  jq --arg sub "$SUBDOMAIN" --arg cert "$CERT_ARN" '
    .Aliases.Quantity += 1 |
    .Aliases.Items += [$sub] |
    .ViewerCertificate.ACMCertificateArn = $cert |
    .ViewerCertificate.SSLSupportMethod = "sni-only" |
    .ViewerCertificate.MinimumProtocolVersion = "TLSv1.2_2021"
  ' cf-config.json > cf-config-updated.json

  aws cloudfront update-distribution \
    --id $DIST_ID \
    --distribution-config file://cf-config-updated.json \
    --if-match $ETAG

  echo "CloudFront updated with alias and certificate"

else
  echo "Alias already exists"
fi

# -----------------------------
# 6. FIND ROUTE53 HOSTED ZONE
# -----------------------------

echo "Locating Route53 hosted zone..."

ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='$DOMAIN.'].Id" \
  --output text | sed 's/\/hostedzone\///')

if [ -z "$ZONE_ID" ]; then
  echo "ERROR: Hosted zone not found"
  exit 1
fi

echo "Hosted zone: $ZONE_ID"

# -----------------------------
# 7. GET CLOUDFRONT DOMAIN (always use CloudFront)
# -----------------------------

CF_ORIGIN=$(aws cloudfront get-distribution \
  --id $DIST_ID \
  --query "Distribution.DomainName" \
  --output text)

echo "Using CloudFront distribution: $CF_ORIGIN"

# -----------------------------
# 8. CREATE DNS RECORD (Delete CNAME first, then create A Alias)
# -----------------------------

echo "Creating Route53 DNS record (atomic change)..."

# First, check if there's an existing CNAME record that needs to be deleted
EXISTING_CNAME=$(aws route53 list-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --query "ResourceRecordSets[?Name=='${SUBDOMAIN}.' && Type=='CNAME'].Name" \
  --output text 2>/dev/null || true)

# Build the atomic change batch
if [ -n "$EXISTING_CNAME" ]; then
  echo "Found existing CNAME record, will delete it and create A Alias record"
  
  cat > dns.json <<EOF
{
  "Comment": "Create BA dashboard subdomain - CloudFront A record",
  "Changes": [
    {
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "$SUBDOMAIN",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "$EXISTING_CNAME"
          }
        ]
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "$SUBDOMAIN",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "$CF_ORIGIN",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
EOF
else
  echo "No existing CNAME found, creating A Alias record"
  
  cat > dns.json <<EOF
{
  "Comment": "Create BA dashboard subdomain - CloudFront A record",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "$SUBDOMAIN",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z2FDTNDATAQYW2",
        "DNSName": "$CF_ORIGIN",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF
fi

aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://dns.json

echo "DNS record created/updated"

# -----------------------------
# CLEANUP
# -----------------------------

echo "Cleaning up temporary files..."
rm -f cf-config.json cf-config-updated.json dns.json
echo "Cleanup completed"

# -----------------------------
# 9. VALIDATE DNS
# -----------------------------

echo "Waiting for DNS propagation..."

sleep 20

DNS_RESULT=$(dig +short $SUBDOMAIN)

if [ -z "$DNS_RESULT" ]; then
  echo "DNS not yet propagated"
else
  echo "DNS resolves to: $DNS_RESULT"
fi

echo "Deployment completed"