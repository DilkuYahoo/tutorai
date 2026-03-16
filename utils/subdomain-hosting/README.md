# Subdomain Hosting Utilities

This directory contains utilities for adding subdomains to an existing hosted site with CloudFront integration.

## Overview

These scripts help you:

1. **Add a new subdomain** (`add-subdomain.sh`) - Create DNS records and configure CloudFront to serve content from an S3 bucket or existing CloudFront distribution
2. **Route to prefix paths** (`add-ba-prefix.sh`) - Attach a CloudFront Function to route requests from a subdomain to a specific path prefix in your S3 bucket

## Prerequisites

Before running these scripts, ensure you have:

- AWS CLI installed and configured with appropriate credentials
- An existing Route53 hosted zone for your domain
- An existing CloudFront distribution
- An S3 bucket with static website hosting enabled (if using S3 as the origin)
- ACM certificate in `us-east-1` covering your domain and subdomain

## Scripts

### 1. add-subdomain.sh

Main script to add a subdomain pointing to CloudFront.

#### Usage

```bash
cd utils/subdomain-hosting
./add-subdomain.sh
```

#### Configuration (Environment Variables or Defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `advicegenie.com.au` | Root domain name |
| `SUBDOMAIN` | `ba.advicegenie.com.au` | Subdomain to create |
| `REGION` | `us-east-1` | AWS region for ACM certificate |
| `S3_REGION` | `ap-southeast-2` | Region where S3 bucket is located |
| `S3_BUCKET` | `www.advicegenie.com.au` | S3 bucket name (leave empty to use existing CloudFront origin) |
| `PREFIX` | `ba` | Path prefix in S3 bucket |

#### What It Does

1. **Finds or creates ACM certificate** - Locates existing certificate or requests a new wildcard certificate
2. **Locates CloudFront distribution** - Finds the distribution by alias
3. **Configures S3 bucket** - Enables static website hosting (if S3_BUCKET specified)
4. **Updates CloudFront alias** - Adds subdomain as an alias to the distribution
5. **Creates DNS record** - Sets up A record pointing to CloudFront (removes any existing CNAME)
6. **Validates DNS** - Waits for propagation and verifies resolution

#### Example with Custom Values

```bash
DOMAIN="example.com" \
SUBDOMAIN="app.example.com" \
S3_BUCKET="app-content" \
PREFIX="dashboard" \
./add-subdomain.sh
```

#### To Skip S3 and Use Only CloudFront

```bash
S3_BUCKET="" ./add-subdomain.sh
```

---

### 2. add-ba-prefix.sh

Attaches a CloudFront Function to route requests from a subdomain to a specific path prefix.

#### Usage

```bash
cd utils/subdomain-hosting
./add-ba-prefix.sh
```

#### Configuration

Edit the variables at the top of the script:

```bash
DIST_ID="E1C5YSQD0KFMCM"           # CloudFront distribution ID
FUNCTION_NAME="advicegenie-prefix-router"
FUNCTION_CODE_FILE="cf-prefix-router.js"
AWS_ACCOUNT_ID="724772096157"
REGION="us-east-1"
```

#### What It Does

1. **Downloads current CloudFront config** - Gets the distribution configuration
2. **Creates CloudFront Function** - Deploys the JavaScript function
3. **Publishes the function** - Makes it available for use
4. **Attaches to default cache behavior** - Associates the function with viewer requests

---

### 3. cf-prefix-router.js

CloudFront Function code that routes requests based on the Host header.

#### How It Works

For requests to `ba.advicegenie.com.au`:
- `/` → `/ba/index.html`
- `/about` → `/ba/about`
- `/assets/style.css` → `/ba/assets/style.css`

This allows you to host multiple applications in a single S3 bucket using path prefixes.

---

## Complete Workflow: Adding a Subdomain

Follow these steps to add a new subdomain with CloudFront and path-based routing:

### Step 1: Prepare Your S3 Bucket

Ensure your S3 bucket has the content organized by prefix:

```
s3://my-bucket/
├── index.html
├── about.html
└── ba/
    ├── index.html
    ├── dashboard.html
    └── assets/
        └── style.css
```

Enable static website hosting:

```bash
aws s3 website s3://my-bucket \
  --index-document index.html \
  --error-document error.html
```

### Step 2: Run add-subdomain.sh

```bash
S3_BUCKET="my-bucket" \
PREFIX="ba" \
SUBDOMAIN="ba.example.com" \
DOMAIN="example.com" \
./add-subdomain.sh
```

This will:
- Create/update ACM certificate
- Add `ba.example.com` as an alias to your CloudFront distribution
- Create an A record in Route53 pointing to CloudFront

### Step 3: (Optional) Configure Path Routing

If you want requests to `ba.example.com` to serve from the `/ba` prefix in your S3 bucket:

```bash
# Update the CloudFront function code to match your subdomain
# Edit cf-prefix-router.js - change "ba.advicegenie.com.au" to "ba.example.com"

# Then run the prefix router script
./add-ba-prefix.sh
```

### Step 4: Verify

```bash
# Check DNS resolution
dig +short ba.example.com

# Should return CloudFront domain, e.g.:
# d1234567890.cloudfront.net

# Test the subdomain
curl -I https://ba.example.com
```

---

## Architecture

```
                    ┌─────────────────┐
                    │   Route53 DNS   │
                    │  A Record       │
                    │  ba.example.com │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────────────────────────────────┐
│           CloudFront Distribution           │
│              d1234567890.cloudfront.net     │
└──────────────────────┬──────────────────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
    ┌─────────────┐        ┌─────────────┐
    │  S3 Origin  │        │ Other Origin│
    │ bucket/ba/* │        │   (API)     │
    └─────────────┘        └─────────────┘
```

---

## Troubleshooting

### DNS Not Resolving

- Wait 2-5 minutes for DNS propagation
- Check that the A record was created: `aws route53 list-resource-record-sets --hosted-zone-id <ZONE_ID>`

### SSL Certificate Errors

- Ensure ACM certificate is in `us-east-1`
- Verify certificate covers the subdomain (check SAN list)
- Wait for certificate validation if newly requested

### CloudFront Serving Wrong Content

- Check CloudFront cache behavior settings
- Invalidate CloudFront cache after updates: `aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"`

### 403 Forbidden Errors

- Check S3 bucket policy allows public read
- Verify S3 bucket website endpoint is configured
- For CloudFront, ensure Origin Access Control (OAC) is configured

---

## Cleanup

To remove a subdomain:

1. Delete the DNS record in Route53
2. Remove the alias from CloudFront distribution
3. Delete the CloudFront Function (if attached)

```bash
# Delete DNS record
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "ba.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d1234567890.cloudfront.net",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

---

## License

Internal use only - AdviceGenie Pty Ltd
