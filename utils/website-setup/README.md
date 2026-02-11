# Website Setup Utilities

This directory contains AWS utility scripts for setting up static websites with S3, CloudFront, and ACM certificates.

## Scripts Overview

| Script | Purpose |
|--------|---------|
| [`acm-cert-manager.py`](acm-cert-manager.py) | Creates and manages ACM SSL/TLS certificates with DNS validation |
| [`setup_s3_static_site.py`](setup_s3_static_site.py) | Creates S3 buckets configured for static website hosting with CloudFront distribution |

---

## Prerequisites

### AWS Credentials

Both scripts use the **default boto3 credentials chain**. Credentials are resolved in this order:

1. **Environment Variables**
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_SESSION_TOKEN` (if using temporary credentials)

2. **AWS Credentials File** (`~/.aws/credentials`)

3. **AWS Configuration File** (`~/.aws/config`)

4. **IAM Roles** (for services running on AWS):
   - EC2 Instance Profiles
   - Lambda Execution Roles
   - ECS Task Roles
   - EKS Pod Roles

**Tip:** For local development, ensure you have [AWS CLI v2](https://aws.amazon.com/cli/) installed and configured with `aws configure`.

### Required IAM Permissions

The AWS identity used must have the following permissions:

**For `acm-cert-manager.py`:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "acm:ListCertificates",
                "acm:DescribeCertificate",
                "acm:RequestCertificate",
                "acm:DeleteCertificate"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "route53:ListHostedZones",
                "route53:ListResourceRecordSets",
                "route53:ChangeResourceRecordSets"
            ],
            "Resource": "*"
        }
    ]
}
```

**For `setup_s3_static_site.py`:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:CreateBucket",
                "s3:GetBucketPolicy",
                "s3:PutBucketPolicy",
                "s3:GetBucketWebsite",
                "s3:PutBucketWebsite",
                "s3:GetPublicAccessBlock",
                "s3:PutPublicAccessBlock",
                "s3:PutObject",
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME"
        },
        {
            "Effect": "Allow",
            "Action": [
                "cloudfront:ListDistributions",
                "cloudfront:GetDistribution",
                "cloudfront:CreateDistribution",
                "cloudfront:UpdateDistribution",
                "cloudfront:CreateCloudFrontOriginAccessIdentity",
                "cloudfront:ListCloudFrontOriginAccessIdentities",
                "cloudfront:GetCloudFrontOriginAccessIdentity",
                "cloudfront:CreateInvalidation"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "acm:ListCertificates",
                "acm:DescribeCertificate",
                "acm:RequestCertificate"
            ],
            "Resource": "*"
        }
    ]
}
```

---

## ACM Certificate Manager (`acm-cert-manager.py`)

Creates and manages AWS Certificate Manager (ACM) certificates with automatic DNS validation.

### Features

- ✅ Creates new or retrieves existing certificates
- ✅ Supports wildcard domains (e.g., `*.example.com`)
- ✅ Automatic DNS validation via Route53
- ✅ Idempotent - safe to run multiple times
- ✅ Waits for certificate validation and issuance
- ✅ Verbose logging throughout

### Usage

```bash
# Basic usage - create certificate for a domain
python acm-cert-manager.py --domain example.com

# Create wildcard certificate
python acm-cert-manager.py --domain "*.example.com"

# Specify AWS region (us-east-1 required for CloudFront)
python acm-cert-manager.py --domain example.com --region us-east-1

# Use specific AWS profile
python acm-cert-manager.py --domain example.com --profile myprofile

# Delete existing certificate
python acm-cert-manager.py --domain example.com --delete-arn "arn:aws:acm:us-east-1:..."

# Increase timeout for slow validations
python acm-cert-manager.py --domain example.com --timeout 900 --poll-interval 60
```

### Arguments

| Argument | Short | Default | Description |
|----------|-------|---------|-------------|
| `--domain` | `-d` | **Required** | Domain name (e.g., `example.com` or `*.example.com`) |
| `--region` | `-r` | `us-east-1` | AWS region (CloudFront requires `us-east-1`) |
| `--profile` | `-p` | None | AWS CLI profile name |
| `--delete-arn` | None | None | Delete certificate by ARN and exit |
| `--timeout` | `-t` | `600` | Timeout in seconds for validation |
| `--poll-interval` | `-i` | `30` | Poll interval in seconds |

### Output Example

```
============================================================
 ACM Certificate Manager with DNS Validation
============================================================

[STEP] Initialized ACM Manager for domain: example.com
[STEP] Searching for existing certificate: example.com
[PASS] ✓ Found certificate: arn:aws:acm:us-east-1:...
[INFO]   Status: ISSUED
[INFO]   Domains: example.com, *.example.com

============================================================
 CERTIFICATE READY
============================================================
[PASS] ✓ Certificate issued successfully!
ARN:    arn:aws:acm:us-east-1:724772096157:certificate/...
Domain: example.com
Status: ISSUED

Use this ARN in your CloudFront configuration:
arn:aws:acm:us-east-1:724772096157:certificate/...
============================================================
```

---

## S3 Static Site Setup (`setup_s3_static_site.py`)

Creates an S3 bucket configured for static website hosting and sets up a CloudFront distribution with SSL certificates and SPA routing support.

### Features

- ✅ Creates S3 bucket with static website hosting
- ✅ Configures public access settings
- ✅ Sets up bucket policy for CloudFront access
- ✅ Creates CloudFront Origin Access Identity (OAI)
- ✅ Creates CloudFront distribution with SSL certificate
- ✅ **SPA Routing** - Configures 403/404 errors to return `index.html` (for React, Vue, Angular apps)
- ✅ **Alternative Domains** - Supports multiple CNAME aliases
- ✅ Deploys dummy validation site
- ✅ Creates cache invalidation
- ✅ Validates deployment

### Configuration

Before running, edit the configuration section at the top of the script:

```python
# S3 Bucket Configuration
S3_BUCKET_NAME = "your-unique-bucket-name"
SITE_PREFIX = "www/"  # Prefix within the bucket
INDEX_DOCUMENT = "index.html"
ERROR_DOCUMENT = "error.html"

# CloudFront Configuration
CLOUDFRONT_ENABLED = True
CLOUDFRONT_DOMAIN_NAME = "example.com"  # Primary custom domain
CLOUDFRONT_ALT_DOMAINS = ["www.example.com", "app.example.com"]  # Alternative domains
CLOUDFRONT_CERTIFICATE_ARN = ""  # Optional: Your ACM certificate ARN

# SPA Routing Configuration
CLOUDFRONT_SPA_ROUTING_ENABLED = True  # Enable 404/403 -> index.html
CLOUDFRONT_ERROR_CODES = [403, 404]
CLOUDFRONT_ERROR_RESPONSE_TIMEOUT = 10
```

### Usage

```bash
# Basic usage - creates bucket, CloudFront, and deploys dummy site
python setup_s3_static_site.py
```

### Configuration Options

#### S3 Configuration

| Variable | Description |
|----------|-------------|
| `S3_BUCKET_NAME` | Unique bucket name (must be globally unique) |
| `SITE_PREFIX` | Prefix path within bucket where site files are stored |
| `INDEX_DOCUMENT` | Index document name (default: `index.html`) |
| `ERROR_DOCUMENT` | Error document name (default: `error.html`) |

#### CloudFront Configuration

| Variable | Description |
|----------|-------------|
| `CLOUDFRONT_ENABLED` | Set to `False` to skip CloudFront setup |
| `CLOUDFRONT_DOMAIN_NAME` | Primary custom domain (e.g., `example.com`) |
| `CLOUDFRONT_ALT_DOMAINS` | List of alternative CNAME domains |
| `CLOUDFRONT_CERTIFICATE_ARN` | Existing ACM certificate ARN (auto-created if empty) |
| `CLOUDFRONT_OAI_ID` | Existing OAI ID (auto-created if empty) |

#### SPA Routing Configuration

| Variable | Description |
|----------|-------------|
| `CLOUDFRONT_SPA_ROUTING_ENABLED` | Enable SPA routing (404/403 -> `index.html`) |
| `CLOUDFRONT_ERROR_CODES` | List of HTTP codes to redirect to `index.html` |
| `CLOUDFRONT_ERROR_RESPONSE_TIMEOUT` | Cache TTL for error responses (seconds) |

### SPA / Static Site Routing

When SPA routing is enabled, CloudFront is configured to:

1. **403 (Forbidden)** - Return `index.html` with HTTP 200
2. **404 (Not Found)** - Return `index.html` with HTTP 200

This enables client-side routing for frameworks like React, Vue, Angular, and Svelte, where the router handles URL paths.

**How it works:**
```
User requests: /dashboard/login
         ↓
CloudFront checks S3 for /dashboard/login
         ↓
S3 returns: 404 Not Found
         ↓
CloudFront intercepts 404
         ↓
Returns: index.html (HTTP 200)
         ↓
React/Vue router handles /dashboard/login
```

### Alternative Domains

The script supports multiple custom domains:

```python
CLOUDFRONT_DOMAIN_NAME = "example.com"
CLOUDFRONT_ALT_DOMAINS = ["www.example.com", "app.example.com"]
```

**Important:** All domains must be covered by the SSL certificate. The script automatically adds all domains to the certificate's Subject Alternative Names (SANs).

### Output Example

```
============================================================
S3 STATIC WEBSITE SETUP
============================================================
Bucket: my-website-bucket
Region: ap-southeast-2
Site Prefix: www/
CloudFront: Enabled
Custom Domain: example.com
Alt Domains: ['www.example.com', 'app.example.com']

...

============================================================
DEPLOYMENT COMPLETE
============================================================

S3 Bucket: my-website-bucket
Site files prefix: www/
S3 Website URL: http://my-website-bucket.s3-website-ap-southeast-2.amazonaws.com/www/

CloudFront Distribution ID: E1ABCDEFGHIJK
CloudFront URL: https://d1234567890.cloudfront.net
Status: Deployed
Custom Domains: example.com, www.example.com, app.example.com

NEXT STEPS:
1. Upload your website files to: s3://my-website-bucket/www/
2. Ensure index.html is in the site prefix directory
3. For custom domain:
   - Create CNAME records pointing to: d1234567890.cloudfront.net
   - Ensure SSL certificate covers all domains
------------------------------------------------------------
```

---

## Common Workflows

### Workflow 1: Complete Static Website Setup

```bash
# 1. Request ACM certificate (run first for DNS validation)
cd utils/website-setup
python acm-cert-manager.py --domain example.com

# 2. Wait for certificate validation (check Route53 for CNAME records)
# Certificate will be auto-validated once DNS propagates

# 3. Create S3 bucket and CloudFront distribution
# Note: Update setup_s3_static_site.py with your bucket name and domains
python setup_s3_static_site.py

# 4. Upload your actual website files
aws s3 sync /path/to/your/site s3://your-bucket-name/www/ --delete

# 5. Create cache invalidation
aws cloudfront create-invalidation \
    --distribution-id YOUR_DIST_ID \
    --paths "/*"
```

### Workflow 2: Update CloudFront for SPA Routing

If you have an existing CloudFront distribution and want to add SPA routing:

```python
# Update these settings in setup_s3_static_site.py
CLOUDFRONT_ENABLED = True
CLOUDFRONT_SPA_ROUTING_ENABLED = True
CLOUDFRONT_ERROR_CODES = [403, 404]
```

Then run the script. It will find the existing distribution and update it.

### Workflow 3: Add Alternative Domain

To add a new CNAME domain to an existing distribution:

```python
CLOUDFRONT_DOMAIN_NAME = "example.com"
CLOUDFRONT_ALT_DOMAINS = ["www.example.com", "app.example.com", "new.example.com"]
```

**Note:** This requires a new certificate that includes the new domain. Run `acm-cert-manager.py` first to get the updated certificate ARN.

---

## Troubleshooting

### Certificate Validation Fails

**Problem:** ACM certificate remains in "Pending Validation" status.

**Solutions:**
1. Check Route53 hosted zones: `aws route53 list-hosted-zones`
2. Verify CNAME records exist:
   ```bash
   aws route53 list-resource-record-sets --hosted-zone-id ZXXX...
   ```
3. Wait for DNS propagation (can take up to 24-48 hours)
4. Ensure CNAME record names match exactly (including the `_` prefix)

### CloudFront Returns 403 Forbidden

**Problem:** Accessing CloudFront URL returns 403.

**Solutions:**
1. Verify bucket policy allows CloudFront OAI:
   ```bash
   aws s3api get-bucket-policy --bucket your-bucket
   ```
2. Check OAI is correctly configured in CloudFront origin
3. Ensure bucket is NOT configured as static website hosting endpoint (use regional endpoint)

### SPA Routing Not Working

**Problem:** React/Vue router returns 404 on refresh.

**Solutions:**
1. Verify `CLOUDFRONT_SPA_ROUTING_ENABLED = True`
2. Check Custom Error Responses are configured:
   ```bash
   aws cloudfront get-distribution-config --id YOUR_DIST_ID
   ```
3. Look for `CustomErrorResponses` section with 403/404 codes
4. Wait 5-10 minutes for distribution to update

### Custom Domain Not Working

**Problem:** CNAME record exists but domain doesn't resolve.

**Solutions:**
1. Verify CNAME points to CloudFront domain name (e.g., `d123.cloudfront.net`)
2. Check certificate covers the domain (in ACM console)
3. Verify domain is in CloudFront distribution aliases
4. Wait for DNS TTL to expire:
   ```bash
   dig +short your-domain.com
   ```

### Access Denied When Uploading Files

**Problem:** `aws s3 sync` fails with Access Denied.

**Solutions:**
1. Check AWS credentials are configured
2. Verify IAM user/role has `s3:PutObject` permission
3. Ensure bucket doesn't have restrictive bucket policies

---

## Security Considerations

### 1. Bucket Permissions

The bucket is configured with:
- Public read access via CloudFront OAI
- No direct public access to S3 endpoint
- Objects must go through CloudFront

### 2. Certificate Security

- ACM certificates are managed by AWS
- Private keys never exposed
- Automatic renewal (if DNS-validated)

### 3. CloudFront Security

- HTTPS only (redirect-to-https policy)
- TLS 1.2 minimum
- SNI-only certificates

---

## Cost Considerations

| Service | Estimated Cost (per month) |
|---------|---------------------------|
| S3 Storage | ~$0.023 per GB |
| S3 Requests | ~$0.0004 per 1,000 requests |
| CloudFront Data Transfer | ~$0.085 per GB (first 1 TB) |
| ACM Certificate | **Free** |

**Note:** Costs vary by region. CloudFront includes a free tier.

---

## File Structure After Deployment

```
your-bucket-name/
├── www/
│   ├── index.html          # Main entry point
│   ├── error.html          # Custom error page
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── images/
│       └── logo.png
```

---

## Additional Resources

- [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/dev/WebsiteHosting.html)
- [CloudFront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)
- [ACM Certificate Documentation](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html)
- [SPA Routing with CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/RequestBehavior.html#RequestBehavior-custom-error)

---

## License

These utilities are provided as-is for AWS infrastructure setup. Use according to your AWS account terms and conditions.
