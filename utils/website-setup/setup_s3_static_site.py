#!/usr/bin/env python3
"""
S3 Bucket Static Website Setup with CloudFront Distribution
============================================================

This script creates an S3 bucket configured for static website hosting
and sets up a CloudFront distribution to serve it.

Parameters (fill these in before running):
"""

# =============================================================================
# CONFIGURATION PARAMETERS - Fill these in before running the script
# =============================================================================

# AWS Credentials (leave empty to use default credential chain or environment variables)
AWS_ACCESS_KEY_ID = ""  # Optional: "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = ""  # Optional: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_REGION = "ap-southeast-2"  # AWS region for resources

# S3 Bucket Configuration
S3_BUCKET_NAME = "advicelab"  # Unique bucket name (must be globally unique)
SITE_PREFIX = "www/"  # Prefix within the bucket where site files are stored
INDEX_DOCUMENT = "index.html"  # Index document name
ERROR_DOCUMENT = "error.html"  # Error document name

# CloudFront Configuration
CLOUDFRONT_ENABLED = True  # Set to False to skip CloudFront setup
CLOUDFRONT_DOMAIN_NAME = ""  # Optional: Custom domain name for CloudFront (e.g., "www.example.com")
CLOUDFRONT_CERTIFICATE_ARN = "arn:aws:acm:us-east-1:724772096157:certificate/779f833d-9f09-4dbd-8898-99e4a245209f"  # Optional: ACM certificate ARN for custom domain
# If using custom domain, certificate will be auto-created if not specified
# Note: Certificates for CloudFront must be in us-east-1 region

# S3 Origin Access Identity (OAI) - leave as empty string for auto-creation
CLOUDFRONT_OAI_ID = ""  # Optional: Existing OAI ID if you have one

# Verbose logging
VERBOSE_LOGGING = True  # Enable detailed logging

# Dummy site deployment (for validation)
DEPLOY_DUMMY_SITE = True  # Deploy a dummy index.html for validation

# CloudFront cache invalidation
CLOUDFRONT_INVALIDATE_CACHE = True  # Create cache invalidation on each run

# Template content - using double braces to escape CSS curly braces
DUMMY_SITE_CONTENT = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Static Website Validation</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
        .container {{ max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; }}
        .status {{ padding: 15px; background: #d4edda; color: #155724; border-radius: 4px; margin-top: 20px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>✓ Static Website Deployment Successful</h1>
        <p>This page validates that your S3 + CloudFront static website is working correctly.</p>
        <div class="status">
            <strong>Status:</strong> Deployed successfully via CloudFront<br>
            <strong>Bucket:</strong> {bucket_name}<br>
            <strong>Prefix:</strong> {site_prefix}<br>
            <strong>Time:</strong> {timestamp}
        </div>
    </div>
</body>
</html>'''

# =============================================================================
# END OF CONFIGURATION PARAMETERS
# =============================================================================

import boto3
import json
import time
import hashlib
import os
from datetime import datetime, timezone
from botocore.exceptions import ClientError


# =============================================================================
# LOGGING UTILITIES
# =============================================================================

def log_step(stage, message):
    """Print a formatted log message."""
    print(f"[{stage}] {message}")


def log_success(stage, message):
    """Print a success message."""
    print(f"[{stage}] ✓ {message}")


def log_warning(stage, message):
    """Print a warning message."""
    print(f"[{stage}] ⚠ {message}")


def log_error(stage, message):
    """Print an error message."""
    print(f"[{stage}] ✗ {message}")


def log_section(title):
    """Print a section header."""
    print(f"\n{'=' * 60}")
    print(f" {title}")
    print(f"{'=' * 60}")


# =============================================================================
# AWS CLIENT FACTORIES
# =============================================================================

def get_s3_client():
    """Create S3 client with optional credentials."""
    config = {"region_name": AWS_REGION}
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
    return boto3.client("s3", **config)


def get_s3_client_us_east_1():
    """Create S3 client for us-east-1 (required for some operations)."""
    config = {"region_name": "us-east-1"}
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
    return boto3.client("s3", **config)


def get_cloudfront_client():
    """Create CloudFront client (must use us-east-1 for certificates)."""
    config = {"region_name": "us-east-1"}
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
    return boto3.client("cloudfront", **config)


def get_acm_client():
    """Create ACM client for certificate management (must be us-east-1 for CloudFront)."""
    config = {"region_name": ACM_REGION}
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
    return boto3.client("acm", **config)


def get_route53_client():
    """Create Route 53 client for DNS validation."""
    config = {"region_name": "us-east-1"}
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        config["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        config["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
    return boto3.client("route53", **config)


# =============================================================================
# S3 BUCKET FUNCTIONS
# =============================================================================

def check_bucket_exists(bucket_name):
    """Check if an S3 bucket already exists and is accessible."""
    s3 = get_s3_client()
    log_step("S3", f"Checking if bucket '{bucket_name}' exists...")
    
    try:
        s3.head_bucket(Bucket=bucket_name)
        log_success("S3", f"Bucket '{bucket_name}' exists and is accessible.")
        return True
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "")
        if error_code == "404":
            log_step("S3", f"Bucket '{bucket_name}' does not exist.")
            return False
        elif error_code == "403":
            log_warning("S3", f"Bucket '{bucket_name}' exists but access denied.")
            return True
        else:
            log_error("S3", f"Error checking bucket: {e}")
            raise


def create_s3_bucket(bucket_name, region):
    """Create an S3 bucket configured for static website hosting."""
    s3 = get_s3_client()
    
    # Check if bucket exists
    if check_bucket_exists(bucket_name):
        log_step("S3", f"Bucket '{bucket_name}' already exists. Skipping creation.")
        return True
    
    log_step("S3", f"Creating bucket '{bucket_name}' in region '{region}'...")
    
    try:
        # Create bucket
        if region == "us-east-1":
            s3.create_bucket(Bucket=bucket_name)
        else:
            s3.create_bucket(
                Bucket=bucket_name,
                CreateBucketConfiguration={"LocationConstraint": region},
            )
        log_success("S3", f"Successfully created bucket: {bucket_name}")
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "BucketAlreadyOwnedByYou":
            log_warning("S3", f"Bucket '{bucket_name}' already owned by you.")
        else:
            log_error("S3", f"Failed to create bucket: {e}")
            raise
    
    return True


def configure_website_hosting(bucket_name):
    """Configure static website hosting on the bucket."""
    s3 = get_s3_client()
    log_step("S3", f"Configuring static website hosting on bucket '{bucket_name}'...")
    
    try:
        # Check existing website configuration
        try:
            existing_config = s3.get_bucket_website(Bucket=bucket_name)
            log_step("S3", f"Existing website configuration found.")
            
            # Check if configuration matches
            current_index = existing_config.get("IndexDocument", {}).get("Suffix", "")
            current_error = existing_config.get("ErrorDocument", {}).get("Key", "")
            
            needs_update = False
            if current_index != INDEX_DOCUMENT:
                log_warning("S3", f"Index document mismatch: current='{current_index}', expected='{INDEX_DOCUMENT}'")
                needs_update = True
            if current_error != ERROR_DOCUMENT:
                log_warning("S3", f"Error document mismatch: current='{current_error}', expected='{ERROR_DOCUMENT}'")
                needs_update = True
            
            if not needs_update:
                log_success("S3", "Website configuration already correct.")
                return True
                
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") == "NoSuchWebsiteConfiguration":
                log_step("S3", "No existing website configuration found.")
            else:
                raise
        
        # Apply website configuration
        s3.put_bucket_website(
            Bucket=bucket_name,
            WebsiteConfiguration={
                "IndexDocument": {"Suffix": INDEX_DOCUMENT},
                "ErrorDocument": {"Key": ERROR_DOCUMENT},
            },
        )
        log_success("S3", f"Applied website configuration (Index: {INDEX_DOCUMENT}, Error: {ERROR_DOCUMENT})")
        
    except ClientError as e:
        log_error("S3", f"Failed to configure website hosting: {e}")
        raise
    
    return True


def configure_public_access(bucket_name):
    """Configure public access settings on the bucket."""
    s3 = get_s3_client()
    log_step("S3", f"Checking public access configuration for bucket '{bucket_name}'...")
    
    try:
        # Get current public access block configuration
        try:
            block_config = s3.get_public_access_block(Bucket=bucket_name)
            current_block = block_config.get("PublicAccessBlockConfiguration", {})
            log_step("S3", f"Current public access block: {current_block}")
            
            # Check if we need to update
            if (not current_block.get("BlockPublicAcls", True) and
                not current_block.get("IgnorePublicAcls", True) and
                not current_block.get("BlockPublicPolicy", True) and
                not current_block.get("RestrictPublicBuckets", True)):
                log_success("S3", "Public access configuration already correct.")
                return True
            
            log_warning("S3", "Public access block settings need to be updated.")
            
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") == "NoSuchPublicAccessBlockConfiguration":
                log_step("S3", "No existing public access block configuration found.")
            else:
                raise
        
        # Apply public access block configuration
        s3.put_public_access_block(
            Bucket=bucket_name,
            PublicAccessBlockConfiguration={
                "BlockPublicAcls": False,
                "IgnorePublicAcls": False,
                "BlockPublicPolicy": False,
                "RestrictPublicBuckets": False,
            },
        )
        log_success("S3", "Public access block configuration updated.")
        
    except ClientError as e:
        log_error("S3", f"Failed to configure public access: {e}")
        raise
    
    return True


def get_bucket_policy(bucket_name):
    """Get the current bucket policy."""
    s3 = get_s3_client()
    
    try:
        response = s3.get_bucket_policy(Bucket=bucket_name)
        return json.loads(response["Policy"])
    except ClientError as e:
        if e.response.get("Error", {}).get("Code") == "NoSuchBucketPolicy":
            return None
        raise


def configure_bucket_policy(bucket_name, site_prefix):
    """Create and apply bucket policy allowing CloudFront OAI access."""
    s3 = get_s3_client()
    log_step("S3", f"Configuring bucket policy for bucket '{bucket_name}'...")
    
    bucket_arn = f"arn:aws:s3:::{bucket_name}"
    resource_path = f"{bucket_arn}/{site_prefix}*"
    
    # Get OAI canonical user ID for the bucket's CloudFront OAI
    oai_canonical_user = None
    if CLOUDFRONT_OAI_ID:
        try:
            cf = get_cloudfront_client()
            response = cf.get_cloud_front_origin_access_identity(Id=CLOUDFRONT_OAI_ID)
            oai_canonical_user = response["CloudFrontOriginAccessIdentity"]["S3CanonicalUserId"]
            log_info(f"Found OAI canonical user ID: {oai_canonical_user[:20]}...")
        except ClientError as e:
            log_warning("CF", f"Could not get OAI details: {e}")
    
    # Check existing policy
    existing_policy = get_bucket_policy(bucket_name)
    
    # Build policy statement - use OAI canonical user if available, otherwise warn
    if oai_canonical_user:
        principal = {"CanonicalUser": oai_canonical_user}
        sid = "AllowOAIRead"
    else:
        principal = {"Service": "cloudfront.amazonaws.com"}
        sid = "AllowCloudFrontServicePrincipalRead"
        log_warning("S3", "No OAI configured - using CloudFront service principal (less secure)")
    
    new_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": sid,
                "Effect": "Allow",
                "Principal": principal,
                "Action": "s3:GetObject",
                "Resource": resource_path,
            }
        ]
    }
    
    if existing_policy:
        log_step("S3", f"Existing policy found. Checking if update needed...")
        # Compare policies (simplified check - checks both old and new Sids)
        existing_statements = existing_policy.get("Statement", [])
        needs_update = True
        
        for stmt in existing_statements:
            # Check for either the old CloudFront service principal or new OAI canonical user
            if stmt.get("Sid") in ["AllowCloudFrontServicePrincipalRead", "AllowOAIRead"] and \
               stmt.get("Effect") == "Allow" and \
               stmt.get("Action") == "s3:GetObject" and \
               stmt.get("Resource") == resource_path:
                needs_update = False
                break
        
        if not needs_update:
            log_success("S3", "Bucket policy already correctly configured.")
            return True
    
    try:
        s3.put_bucket_policy(Bucket=bucket_name, Policy=json.dumps(new_policy))
        log_success("S3", f"Applied bucket policy for CloudFront access (Resource: {site_prefix}*)")
    except ClientError as e:
        log_error("S3", f"Failed to apply bucket policy: {e}")
        raise
    
    return True


# =============================================================================
# ACM CERTIFICATE FUNCTIONS (CloudFront requires certificates in us-east-1)
# =============================================================================

ACM_REGION = "us-east-1"  # CloudFront certificates MUST be in us-east-1

def check_certificate_exists(domain_name):
    """Check if an existing ACM certificate exists for the domain."""
    acm = get_acm_client()
    log_step("ACM", f"Checking for existing certificate for domain: {domain_name}")
    
    try:
        response = acm.list_certificates()
        certificates = response.get("CertificateSummaryList", [])
        
        for cert in certificates:
            cert_arn = cert["CertificateArn"]
            # Get certificate details
            cert_detail = acm.describe_certificate(CertificateArn=cert_arn)
            cert_info = cert_detail["Certificate"]
            
            # Check if this cert covers our domain
            domain_name_upper = domain_name.upper()
            for cert_domain in cert_info.get("SubjectAlternativeNames", []):
                if cert_domain.upper() == domain_name_upper:
                    # Check if certificate is issued
                    if cert_info.get("Status") == "ISSUED":
                        log_success("ACM", f"Found existing issued certificate: {cert_arn}")
                        return cert_arn
                    else:
                        log_warning("ACM", f"Certificate exists but status is: {cert_info.get('Status')}")
                        return cert_arn
        
        log_step("ACM", "No existing certificate found for this domain.")
        return None
        
    except ClientError as e:
        log_error("ACM", f"Failed to list certificates: {e}")
        raise


def request_certificate(domain_name):
    """Request a new ACM certificate for the domain."""
    acm = get_acm_client()
    log_step("ACM", f"Requesting new certificate for domain: {domain_name}")
    
    try:
        response = acm.request_certificate(
            DomainName=domain_name,
            ValidationMethod="DNS",
            SubjectAlternativeNames=[
                f"*.{domain_name}",
                domain_name,
            ],
            Options={
                "CertificateTransparencyLoggingPreference": "ENABLED",
            },
        )
        
        cert_arn = response["CertificateArn"]
        log_success("ACM", f"Certificate requested: {cert_arn}")
        log_warning("ACM", "DNS validation required. Please add the CNAME records shown below.")
        
        return cert_arn
        
    except ClientError as e:
        log_error("ACM", f"Failed to request certificate: {e}")
        raise


def wait_for_certificate_validation(cert_arn, timeout=600):
    """Wait for ACM certificate to be validated and issued."""
    acm = get_acm_client()
    log_step("ACM", "Waiting for certificate validation...")
    
    start_time = time.time()
    poll_interval = 30
    
    while time.time() - start_time < timeout:
        try:
            response = acm.describe_certificate(CertificateArn=cert_arn)
            cert = response["Certificate"]
            status = cert.get("Status", "")
            
            if status == "ISSUED":
                log_success("ACM", "Certificate successfully issued!")
                return True
            
            elif status == "PENDING_VALIDATION":
                log_step("ACM", f"Validation pending. Domain validation options:")
                
                # Show DNS validation records
                if "DomainValidationOptions" in cert:
                    for dvo in cert["DomainValidationOptions"]:
                        log_step("ACM", f"  Domain: {dvo.get('DomainName')}")
                        if "ResourceRecord" in dvo:
                            rr = dvo["ResourceRecord"]
                            log_step("ACM", f"    Type: {rr.get('Type')}")
                            log_step("ACM", f"    Name: {rr.get('Name')}")
                            log_step("ACM", f"    Value: {rr.get('Value')}")
                
                log_warning("ACM", f"Waiting {poll_interval}s before checking again...")
                time.sleep(poll_interval)
            else:
                log_warning(f"ACM", f"Certificate status: {status}")
                time.sleep(poll_interval)
                
        except ClientError as e:
            log_error("ACM", f"Error checking certificate status: {e}")
            time.sleep(poll_interval)
    
    log_error("ACM", f"Certificate validation timed out after {timeout}s")
    return False


def get_or_create_certificate(domain_name):
    """Get existing certificate or create a new one."""
    # If certificate ARN is configured, use it
    if CLOUDFRONT_CERTIFICATE_ARN:
        log_step("ACM", f"Using configured certificate: {CLOUDFRONT_CERTIFICATE_ARN}")
        return CLOUDFRONT_CERTIFICATE_ARN
    
    # If no custom domain, use default CloudFront certificate
    if not domain_name:
        log_step("ACM", "No custom domain specified. Using default CloudFront certificate.")
        return None
    
    # Check for existing certificate
    existing_cert = check_certificate_exists(domain_name)
    if existing_cert:
        return existing_cert
    
    # Request new certificate
    cert_arn = request_certificate(domain_name)
    
    # Wait for validation
    if not wait_for_certificate_validation(cert_arn):
        log_warning("ACM", "Certificate validation pending. Continuing with ARN...")
    
    return cert_arn


# =============================================================================
# CLOUDFRONT FUNCTIONS
# =============================================================================

def check_origin_access_identity():
    """Check and return CloudFront Origin Access Identity."""
    cf = get_cloudfront_client()
    log_step("CF", "Checking for existing Origin Access Identity...")
    
    if CLOUDFRONT_OAI_ID:
        log_step("CF", f"Using configured OAI: {CLOUDFRONT_OAI_ID}")
        return CLOUDFRONT_OAI_ID
    
    try:
        response = cf.list_cloud_front_origin_access_identities()
        oai_list = response.get("CloudFrontOriginAccessIdentityList", {}).get("Items", [])
        
        for oai in oai_list:
            if oai.get("Comment") == f"OAI for {S3_BUCKET_NAME}":
                log_success("CF", f"Found existing OAI: {oai['Id']}")
                return oai["Id"]
        
        log_step("CF", "No existing OAI found for this bucket.")
        return None
        
    except ClientError as e:
        log_error("CF", f"Failed to list OAIs: {e}")
        raise


def create_origin_access_identity():
    """Create a CloudFront Origin Access Identity."""
    cf = get_cloudfront_client()
    
    existing_oai_id = check_origin_access_identity()
    if existing_oai_id:
        return existing_oai_id
    
    log_step("CF", "Creating new Origin Access Identity...")
    
    try:
        response = cf.create_cloud_front_origin_access_identity(
            CloudFrontOriginAccessIdentityConfig={
                "CallerReference": f"oai-{S3_BUCKET_NAME}-{int(time.time())}",
                "Comment": f"OAI for {S3_BUCKET_NAME}",
            }
        )
        oai_id = response["CloudFrontOriginAccessIdentity"]["Id"]
        log_success("CF", f"Created new OAI: {oai_id}")
        return oai_id
    except ClientError as e:
        log_error("CF", f"Failed to create OAI: {e}")
        raise


def find_existing_distribution(bucket_name, site_prefix):
    """Find existing CloudFront distribution for this bucket."""
    cf = get_cloudfront_client()
    log_step("CF", f"Searching for existing CloudFront distributions for bucket '{bucket_name}'...")
    
    try:
        response = cf.list_distributions()
        distributions = response.get("DistributionList", {}).get("Items", [])
        
        for dist in distributions:
            # Check comment for bucket name
            if dist.get("Comment", "").find(bucket_name) != -1:
                log_success("CF", f"Found existing distribution: {dist['Id']} ({dist['DomainName']})")
                return dist
            
            # Check origins
            for origin in dist.get("Origins", {}).get("Items", []):
                if origin.get("DomainName", "").find(bucket_name) != -1:
                    log_success("CF", f"Found existing distribution: {dist['Id']} ({dist['DomainName']})")
                    return dist
        
        log_step("CF", "No existing CloudFront distribution found for this bucket.")
        return None
        
    except ClientError as e:
        log_error("CF", f"Failed to list distributions: {e}")
        raise


def create_cloudfront_distribution(bucket_name, site_prefix, oai_id, cert_arn):
    """Create a CloudFront distribution pointing to the S3 bucket."""
    cf = get_cloudfront_client()
    
    if not CLOUDFRONT_ENABLED:
        log_step("CF", "CloudFront distribution creation disabled in config.")
        return None
    
    # Check for existing distribution
    existing_dist = find_existing_distribution(bucket_name, site_prefix)
    if existing_dist:
        log_warning("CF", "Existing distribution found. Update functionality not implemented yet.")
        return {
            "id": existing_dist["Id"],
            "domain_name": existing_dist["DomainName"],
            "status": existing_dist["Status"],
        }
    
    log_step("CF", f"Creating CloudFront distribution for bucket '{bucket_name}'...")
    
    # Use S3 regional endpoint format for OAI (not website endpoint)
    # This is required for CloudFront to access S3 buckets in regions other than us-east-1
    if AWS_REGION == "us-east-1":
        bucket_url = f"{bucket_name}.s3.amazonaws.com"
    else:
        bucket_url = f"{bucket_name}.s3-{AWS_REGION}.amazonaws.com"
    origin_path = f"/{site_prefix.rstrip('/')}" if site_prefix else ""
    
    # Build origins configuration
    origins = [
        {
            "Id": f"S3-{bucket_name}",
            "DomainName": bucket_url,
            "OriginPath": origin_path,
            "CustomOriginConfig": {
                "HTTPPort": 80,
                "HTTPSPort": 443,
                "OriginProtocolPolicy": "http-only",
            },
        }
    ]
    
    # Add OAI if available
    if oai_id:
        origins[0]["S3OriginConfig"] = {"OriginAccessIdentity": f"origin-access-identity/cloudfront/{oai_id}"}
        del origins[0]["CustomOriginConfig"]
        log_step("CF", f"Using OAI: {oai_id}")
    
    # Build default cache behavior
    cache_behaviors = [
        {
            "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]},
            "TargetOriginId": f"S3-{bucket_name}",
            "ForwardedValues": {
                "QueryString": False,
                "Cookies": {"Forward": "none"},
            },
            "TrustedSigners": {"Enabled": False, "Quantity": 0},
            "ViewerProtocolPolicy": "redirect-to-https",
            "MinTTL": 0,
            "DefaultTTL": 86400,
            "MaxTTL": 31536000,
        }
    ]
    
    # Configure aliases for custom domain
    aliases = {"Quantity": 0}
    if CLOUDFRONT_DOMAIN_NAME:
        aliases = {
            "Quantity": 1,
            "Items": [CLOUDFRONT_DOMAIN_NAME],
        }
        log_step("CF", f"Using custom domain: {CLOUDFRONT_DOMAIN_NAME}")
    
    # Configure certificate
    viewer_certificate = {"CloudFrontDefaultCertificate": True}
    if cert_arn:
        viewer_certificate = {
            "ACMCertificateArn": cert_arn,
            "SSLSupportMethod": "sni-only",
            "MinimumProtocolVersion": "TLSv1.2_2021",
        }
        log_step("CF", f"Using ACM certificate: {cert_arn}")
    elif CLOUDFRONT_DOMAIN_NAME:
        log_warning("CF", "Custom domain specified but no certificate. Using default certificate.")
    
    try:
        response = cf.create_distribution(
            DistributionConfig={
                "CallerReference": f"dist-{bucket_name}-{int(time.time())}",
                "Comment": f"Static website: {bucket_name}",
                "Enabled": True,
                "Aliases": aliases,
                "DefaultRootObject": INDEX_DOCUMENT,
                "Origins": {"Quantity": 1, "Items": origins},
                "DefaultCacheBehavior": cache_behaviors[0],
                "ViewerCertificate": viewer_certificate,
                "HttpVersion": "http2and3",
                "IsIPV6Enabled": True,
            }
        )
        
        distribution_id = response["Distribution"]["Id"]
        domain_name = response["Distribution"]["DomainName"]
        status = response["Distribution"]["Status"]
        
        log_success("CF", f"Created CloudFront distribution: {distribution_id}")
        log_step("CF", f"Status: {status}")
        log_step("CF", f"Domain: https://{domain_name}")
        log_warning("CF", "Distribution may take 5-10 minutes to deploy globally.")
        
        return {
            "id": distribution_id,
            "domain_name": domain_name,
            "status": status,
        }
    except ClientError as e:
        log_error("CF", f"Failed to create distribution: {e}")
        raise


def invalidate_cloudfront_cache(distribution_id, site_prefix):
    """Create a CloudFront cache invalidation to drop cached content."""
    if not CLOUDFRONT_INVALIDATE_CACHE:
        log_step("CF", "Cache invalidation disabled in config.")
        return True
    
    if not distribution_id:
        log_step("CF", "No distribution ID provided. Skipping cache invalidation.")
        return True
    
    cf = get_cloudfront_client()
    log_step("CF", f"Creating cache invalidation for distribution: {distribution_id}")
    
    # Create invalidation for all objects in the site prefix
    path_pattern = f"/{site_prefix}*" if site_prefix else "/*"
    
    try:
        response = cf.create_invalidation(
            DistributionId=distribution_id,
            InvalidationBatch={
                "CallerReference": f"invalidate-{int(time.time())}",
                "Paths": {
                    "Quantity": 1,
                    "Items": [path_pattern],
                }
            }
        )
        
        invalidation_id = response["Invalidation"]["Id"]
        status = response["Invalidation"]["Status"]
        log_success("CF", f"Cache invalidation created: {invalidation_id} (Status: {status})")
        log_warning("CF", "Cache invalidation may take a few minutes to propagate.")
        return True
        
    except ClientError as e:
        log_error("CF", f"Failed to create cache invalidation: {e}")
        return False


# =============================================================================
# DUMMY SITE DEPLOYMENT AND VALIDATION
# =============================================================================

def deploy_dummy_site(bucket_name, site_prefix):
    """Deploy a dummy index.html to the S3 bucket."""
    if not DEPLOY_DUMMY_SITE:
        log_step("VALIDATION", "Dummy site deployment disabled in config.")
        return True
    
    s3 = get_s3_client()
    log_step("VALIDATION", f"Deploying dummy site to s3://{bucket_name}/{site_prefix}{INDEX_DOCUMENT}")
    
    # Generate dummy content
    timestamp = datetime.now(timezone.utc).isoformat()
    content = DUMMY_SITE_CONTENT.format(
        bucket_name=bucket_name,
        site_prefix=site_prefix,
        timestamp=timestamp,
    )
    
    try:
        # Upload index.html
        key = f"{site_prefix}{INDEX_DOCUMENT}"
        s3.put_object(
            Bucket=bucket_name,
            Key=key,
            Body=content,
            ContentType="text/html",
        )
        log_success("VALIDATION", f"Uploaded {key} to S3")
        
        # Upload error.html
        error_content = """<!DOCTYPE html>
<html><head><title>Error</title></head>
<body><h1>Error Page</h1><p>Custom error document for S3 static website.</p></body></html>"""
        
        error_key = f"{site_prefix}{ERROR_DOCUMENT}"
        s3.put_object(
            Bucket=bucket_name,
            Key=error_key,
            Body=error_content,
            ContentType="text/html",
        )
        log_success("VALIDATION", f"Uploaded {error_key} to S3")
        
        return True
        
    except ClientError as e:
        log_error("VALIDATION", f"Failed to deploy dummy site: {e}")
        raise


def validate_s3_access(bucket_name, site_prefix):
    """Validate S3 website access."""
    log_step("VALIDATION", "Testing S3 website access...")
    
    s3 = get_s3_client()
    
    try:
        # List objects in the site prefix
        response = s3.list_objects_v2(Bucket=bucket_name, Prefix=site_prefix)
        objects = response.get("Contents", [])
        
        log_step("VALIDATION", f"Objects in '{site_prefix}':")
        for obj in objects:
            log_step("VALIDATION", f"  - {obj['Key']} ({obj['Size']} bytes)")
        
        if not objects:
            log_warning("VALIDATION", "No objects found in site prefix.")
        
        # Test GET object
        key = f"{site_prefix}{INDEX_DOCUMENT}"
        response = s3.get_object(Bucket=bucket_name, Key=key)
        content = response["Body"].read().decode("utf-8")[:200]
        
        log_success("VALIDATION", f"Successfully read {key}")
        log_step("VALIDATION", f"Content preview: {content[:100]}...")
        
        return True
        
    except ClientError as e:
        log_error("VALIDATION", f"S3 access test failed: {e}")
        return False


def validate_cloudfront_access(distribution_domain_name):
    """Validate CloudFront distribution access."""
    if not distribution_domain_name:
        log_step("VALIDATION", "No CloudFront distribution to validate.")
        return None
    
    import urllib.request
    
    url = f"https://{distribution_domain_name}/{INDEX_DOCUMENT}"
    log_step("VALIDATION", f"Testing CloudFront access: {url}")
    
    try:
        # Wait a bit for distribution to be ready
        log_warning("VALIDATION", "Note: CloudFront may take 5-10 minutes to fully deploy.")
        
        # Make request
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.status
            content = response.read().decode("utf-8")
            
            if status == 200:
                log_success("VALIDATION", f"CloudFront access successful (HTTP {status})")
                log_step("VALIDATION", f"Content contains 'Static Website': {'Static Website' in content}")
                return True
            else:
                log_warning("VALIDATION", f"Unexpected status: {status}")
                return False
                
    except urllib.error.URLError as e:
        log_warning("VALIDATION", f"CloudFront access test failed (expected if not fully deployed): {e.reason}")
        log_step("VALIDATION", "This is normal if CloudFront distribution was just created.")
        return False
    except Exception as e:
        log_error("VALIDATION", f"Unexpected error: {e}")
        return False


def run_validation(bucket_name, site_prefix, cf_info):
    """Run all validation steps."""
    log_section("VALIDATION")
    
    all_passed = True
    
    # Step 1: Validate S3 access
    log_step("VALIDATION", "Step 1: S3 Website Access Test")
    s3_ok = validate_s3_access(bucket_name, site_prefix)
    if s3_ok:
        log_success("VALIDATION", "S3 access validation: PASSED")
    else:
        log_error("VALIDATION", "S3 access validation: FAILED")
        all_passed = False
    
    # Step 2: Validate CloudFront access
    if cf_info and cf_info.get("domain_name"):
        log_step("VALIDATION", "Step 2: CloudFront Access Test")
        cf_ok = validate_cloudfront_access(cf_info["domain_name"])
        if cf_ok:
            log_success("VALIDATION", "CloudFront access validation: PASSED")
        elif cf_ok is False:
            log_error("VALIDATION", "CloudFront access validation: FAILED")
            all_passed = False
        else:
            log_warning("VALIDATION", "CloudFront access validation: PENDING (not fully deployed)")
    else:
        log_step("VALIDATION", "Step 2: Skipped (no CloudFront distribution)")
    
    # Final summary
    log_section("VALIDATION SUMMARY")
    if all_passed:
        log_success("VALIDATION", "All validations PASSED!")
    else:
        log_warning("VALIDATION", "Some validations failed. Check logs above.")
    
    return all_passed


# =============================================================================
# MAIN EXECUTION
# =============================================================================

def print_deployment_info(bucket_name, site_prefix, cf_info):
    """Print deployment information and next steps."""
    print("\n" + "=" * 60)
    print("DEPLOYMENT COMPLETE")
    print("=" * 60)
    
    print(f"\nS3 Bucket: {bucket_name}")
    print(f"Site files prefix: {site_prefix}")
    print(f"S3 Website URL: http://{bucket_name}.s3-website-{AWS_REGION}.amazonaws.com/{site_prefix}")
    
    if cf_info:
        print(f"\nCloudFront Distribution ID: {cf_info['id']}")
        print(f"CloudFront URL: https://{cf_info['domain_name']}")
        if "status" in cf_info:
            print(f"Status: {cf_info['status']}")
        if CLOUDFRONT_DOMAIN_NAME:
            print(f"Custom Domain: https://{CLOUDFRONT_DOMAIN_NAME}")
    
    print("\n" + "-" * 60)
    print("NEXT STEPS:")
    print("-" * 60)
    print(f"1. Upload your website files to: s3://{bucket_name}/{site_prefix}")
    print("2. Ensure index.html is in the site prefix directory")
    print("3. For custom domain:")
    if cf_info:
        print(f"   - Create a CNAME record pointing to: {cf_info['domain_name']}")
        print(f"   - If using {CLOUDFRONT_DOMAIN_NAME}, ensure certificate is valid")
    print("-" * 60)


def main():
    """Main execution function."""
    print("=" * 60)
    print("S3 STATIC WEBSITE SETUP")
    print("=" * 60)
    print(f"Bucket: {S3_BUCKET_NAME}")
    print(f"Region: {AWS_REGION}")
    print(f"Site Prefix: {SITE_PREFIX}")
    print(f"CloudFront: {'Enabled' if CLOUDFRONT_ENABLED else 'Disabled'}")
    print(f"Dummy Site: {'Enabled' if DEPLOY_DUMMY_SITE else 'Disabled'}")
    print(f"Cache Invalidation: {'Enabled' if CLOUDFRONT_INVALIDATE_CACHE else 'Disabled'}")
    print()
    
    # Step 1: Check/create S3 bucket
    log_section("STEP 1: S3 BUCKET")
    create_s3_bucket(S3_BUCKET_NAME, AWS_REGION)
    
    # Step 2: Configure website hosting
    configure_website_hosting(S3_BUCKET_NAME)
    
    # Step 3: Configure public access
    configure_public_access(S3_BUCKET_NAME)
    
    # Step 4: Configure bucket policy
    configure_bucket_policy(S3_BUCKET_NAME, SITE_PREFIX)
    
    # Step 5: Handle ACM certificate
    log_section("STEP 2: ACM CERTIFICATE")
    cert_arn = get_or_create_certificate(CLOUDFRONT_DOMAIN_NAME)
    
    # Step 6: Create CloudFront OAI
    log_section("STEP 3: CLOUDFRONT")
    oai_id = create_origin_access_identity()
    
    # Step 7: Create CloudFront distribution
    cf_info = create_cloudfront_distribution(S3_BUCKET_NAME, SITE_PREFIX, oai_id, cert_arn)
    
    # Step 7b: Update DefaultRootObject if needed
    log_section("STEP 4: CONFIGURE CLOUDFRONT")
    if cf_info and cf_info.get("id"):
        log_step("CF", f"Configuring DefaultRootObject for distribution: {cf_info['id']}")
        try:
            cf = get_cloudfront_client()
            # Get current config
            response = cf.get_distribution_config(Id=cf_info["id"])
            config = response["DistributionConfig"]
            
            if config.get("DefaultRootObject") != INDEX_DOCUMENT:
                log_step("CF", f"Updating DefaultRootObject from '{config.get('DefaultRootObject', '')}' to '{INDEX_DOCUMENT}'")
                config["DefaultRootObject"] = INDEX_DOCUMENT
                cf.update_distribution(
                    DistributionConfig=config,
                    Id=cf_info["id"],
                    IfMatch=response["ETag"]
                )
                log_success("CF", "DefaultRootObject updated successfully")
            else:
                log_success("CF", "DefaultRootObject already correctly configured")
        except ClientError as e:
            log_error("CF", f"Failed to update DefaultRootObject: {e}")
    
    # Step 8: Deploy dummy site
    if DEPLOY_DUMMY_SITE:
        log_section("STEP 6: DUMMY SITE DEPLOYMENT")
        deploy_dummy_site(S3_BUCKET_NAME, SITE_PREFIX)
    
    # Step 9: Invalidate CloudFront cache
    log_section("STEP 7: CACHE INVALIDATION")
    if cf_info and cf_info.get("id"):
        invalidate_cloudfront_cache(cf_info["id"], SITE_PREFIX)
    else:
        log_step("CF", "No CloudFront distribution found. Skipping cache invalidation.")
    
    # Step 10: Run validation
    run_validation(S3_BUCKET_NAME, SITE_PREFIX, cf_info)
    
    # Print deployment info
    print_deployment_info(S3_BUCKET_NAME, SITE_PREFIX, cf_info)
    
    return {
        "bucket_name": S3_BUCKET_NAME,
        "site_prefix": SITE_PREFIX,
        "cloudfront": cf_info,
        "certificate_arn": cert_arn,
    }


if __name__ == "__main__":
    main()
