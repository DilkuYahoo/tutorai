#!/usr/bin/env python3
"""
DNS Zone Manager with CloudFront and ACM
Creates DNS records, CloudFront distributions, and ACM certificates
"""

import boto3
import json
import time
import sys
from typing import Dict, Optional
from botocore.exceptions import ClientError

# Load configuration
def load_config(config_file: str = 'dns_config.json') -> Dict:
    """Load configuration from JSON file"""
    try:
        with open(config_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Config file {config_file} not found")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {config_file}")
        sys.exit(1)

def validate_route53_zone(route53_client, zone_id: str) -> bool:
    """Validate that the Route53 hosted zone exists"""
    try:
        response = route53_client.get_hosted_zone(Id=zone_id)
        print(f"✓ Route53 zone validated: {response['HostedZone']['Name']}")
        return True
    except ClientError as e:
        print(f"✗ Route53 zone validation failed: {e}")
        return False

def request_acm_certificate(acm_client, domain_name: str, zone_id: str) -> Optional[str]:
    """Request an ACM certificate for the domain"""
    try:
        response = acm_client.request_certificate(
            DomainName=domain_name,
            ValidationMethod='DNS',
            Options={'CertificateTransparencyLoggingPreference': 'ENABLED'}
        )
        cert_arn = response['CertificateArn']
        print(f"✓ ACM certificate requested: {cert_arn}")
        return cert_arn
    except ClientError as e:
        print(f"✗ ACM certificate request failed: {e}")
        return None

def get_acm_validation_records(acm_client, cert_arn: str) -> Optional[Dict]:
    """Get DNS validation records from ACM certificate"""
    max_attempts = 30
    for attempt in range(max_attempts):
        try:
            response = acm_client.describe_certificate(CertificateArn=cert_arn)
            options = response['Certificate'].get('DomainValidationOptions', [])
            
            if options and 'ResourceRecord' in options[0]:
                validation_record = options[0]['ResourceRecord']
                print(f"✓ ACM validation records retrieved")
                return validation_record
            
            print(f"  Waiting for validation records... ({attempt + 1}/{max_attempts})")
            time.sleep(2)
        except ClientError as e:
            print(f"✗ Failed to get validation records: {e}")
            return None
    
    print("✗ Timeout waiting for validation records")
    return None

def create_route53_validation_record(route53_client, zone_id: str, validation_record: Dict) -> bool:
    """Create Route53 record for ACM validation"""
    try:
        route53_client.change_resource_record_sets(
            HostedZoneId=zone_id,
            ChangeBatch={
                'Changes': [{
                    'Action': 'UPSERT',
                    'ResourceRecordSet': {
                        'Name': validation_record['Name'],
                        'Type': validation_record['Type'],
                        'TTL': 300,
                        'ResourceRecords': [{'Value': validation_record['Value']}]
                    }
                }]
            }
        )
        print(f"✓ Validation record created in Route53")
        return True
    except ClientError as e:
        print(f"✗ Failed to create validation record: {e}")
        return False

def wait_for_certificate_validation(acm_client, cert_arn: str, timeout: int = 300) -> bool:
    """Wait for ACM certificate to be validated"""
    print("  Waiting for certificate validation (this may take a few minutes)...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            response = acm_client.describe_certificate(CertificateArn=cert_arn)
            status = response['Certificate']['Status']
            
            if status == 'ISSUED':
                print(f"✓ Certificate validated and issued")
                return True
            elif status == 'FAILED':
                print(f"✗ Certificate validation failed")
                return False
            
            time.sleep(10)
        except ClientError as e:
            print(f"✗ Error checking certificate status: {e}")
            return False
    
    print("✗ Timeout waiting for certificate validation")
    return False

def create_cloudfront_distribution(cf_client, domain_name: str, cert_arn: str, origin_domain: str, origin_type: str = 'custom') -> Optional[str]:
    """Create CloudFront distribution with support for S3 and custom origins"""
    try:
        caller_reference = f"{domain_name}-{int(time.time())}"
        
        # Determine origin configuration based on type
        if origin_type.lower() == 's3':
            # S3 website endpoint or bucket
            origin_config = {
                'Id': 'origin1',
                'DomainName': origin_domain,
                'CustomOriginConfig': {
                    'HTTPPort': 80,
                    'HTTPSPort': 443,
                    'OriginProtocolPolicy': 'http-only',  # S3 website endpoints only support HTTP
                    'OriginReadTimeout': 30,
                    'OriginKeepaliveTimeout': 5
                }
            }
        elif origin_type.lower() == 's3-bucket':
            # Direct S3 bucket access (not website endpoint)
            origin_config = {
                'Id': 'origin1',
                'DomainName': origin_domain,
                'S3OriginConfig': {
                    'OriginAccessIdentity': ''  # Empty for public buckets, can be configured for OAI
                }
            }
        else:
            # Custom origin (HTTPS backend)
            origin_config = {
                'Id': 'origin1',
                'DomainName': origin_domain,
                'CustomOriginConfig': {
                    'HTTPPort': 80,
                    'HTTPSPort': 443,
                    'OriginProtocolPolicy': 'https-only',
                    'OriginReadTimeout': 30,
                    'OriginKeepaliveTimeout': 5
                }
            }
        
        distribution_config = {
            'CallerReference': caller_reference,
            'Comment': f'Distribution for {domain_name}',
            'Enabled': True,
            'Origins': {
                'Quantity': 1,
                'Items': [origin_config]
            },
            'DefaultCacheBehavior': {
                'TargetOriginId': 'origin1',
                'ViewerProtocolPolicy': 'redirect-to-https',
                'AllowedMethods': {
                    'Quantity': 7,
                    'Items': ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
                    'CachedMethods': {
                        'Quantity': 2,
                        'Items': ['GET', 'HEAD']
                    }
                },
                'ForwardedValues': {
                    'QueryString': True,
                    'Cookies': {'Forward': 'none'},
                    'Headers': {
                        'Quantity': 0
                    }
                },
                'MinTTL': 0,
                'DefaultTTL': 86400,
                'MaxTTL': 31536000,
                'Compress': True,
                'TrustedSigners': {
                    'Enabled': False,
                    'Quantity': 0
                }
            },
            'Aliases': {
                'Quantity': 1,
                'Items': [domain_name]
            },
            'ViewerCertificate': {
                'ACMCertificateArn': cert_arn,
                'SSLSupportMethod': 'sni-only',
                'MinimumProtocolVersion': 'TLSv1.2_2021'
            }
        }
        
        response = cf_client.create_distribution(DistributionConfig=distribution_config)
        distribution_id = response['Distribution']['Id']
        distribution_domain = response['Distribution']['DomainName']
        
        print(f"✓ CloudFront distribution created: {distribution_id}")
        print(f"  Domain: {distribution_domain}")
        
        return distribution_id, distribution_domain
    except ClientError as e:
        print(f"✗ CloudFront distribution creation failed: {e}")
        return None, None

def wait_for_distribution_deployment(cf_client, distribution_id: str, timeout: int = 600) -> bool:
    """Wait for CloudFront distribution to be deployed"""
    print("  Waiting for distribution deployment (this may take several minutes)...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            response = cf_client.get_distribution(Id=distribution_id)
            status = response['Distribution']['Status']
            
            if status == 'Deployed':
                print(f"✓ Distribution deployed")
                return True
            
            time.sleep(15)
        except ClientError as e:
            print(f"✗ Error checking distribution status: {e}")
            return False
    
    print("✗ Timeout waiting for distribution deployment")
    return False

def create_route53_record(route53_client, zone_id: str, record_name: str, cf_domain: str) -> bool:
    """Create Route53 A record pointing to CloudFront"""
    try:
        route53_client.change_resource_record_sets(
            HostedZoneId=zone_id,
            ChangeBatch={
                'Changes': [{
                    'Action': 'UPSERT',
                    'ResourceRecordSet': {
                        'Name': record_name,
                        'Type': 'A',
                        'AliasTarget': {
                            'HostedZoneId': 'Z2FDTNDATAQYW2',  # CloudFront hosted zone ID
                            'DNSName': cf_domain,
                            'EvaluateTargetHealth': False
                        }
                    }
                }]
            }
        )
        print(f"✓ DNS A record created: {record_name} -> {cf_domain}")
        return True
    except ClientError as e:
        print(f"✗ Failed to create DNS record: {e}")
        return False

def save_deployment_info(config: Dict, cert_arn: str, distribution_id: str):
    """Save deployment information for cleanup"""
    deployment_file = 'deployment_info.json'
    deployment_data = {
        'zone_id': config['zone_id'],
        'record_name': config['record_name'],
        'certificate_arn': cert_arn,
        'distribution_id': distribution_id,
        'timestamp': time.time()
    }
    
    with open(deployment_file, 'w') as f:
        json.dump(deployment_data, f, indent=2)
    
    print(f"✓ Deployment info saved to {deployment_file}")

def main():
    print("=== DNS Zone Manager with CloudFront ===\n")
    
    # Load configuration
    config = load_config()
    
    # Initialize AWS clients
    # ACM must be in us-east-1 for CloudFront (global requirement)
    # Other services use ap-southeast-2 (Sydney)
    acm_client = boto3.client('acm', region_name='us-east-1')
    cf_client = boto3.client('cloudfront', region_name='ap-southeast-2')
    route53_client = boto3.client('route53', region_name='ap-southeast-2')
    
    # Extract config values
    zone_id = config['zone_id']
    record_name = config['record_name']
    origin_domain = config['origin_domain']
    origin_type = config.get('origin_type', 's3')  # Default to S3 website hosting
    
    print(f"Configuration:")
    print(f"  Zone ID: {zone_id}")
    print(f"  Record: {record_name}")
    print(f"  Origin: {origin_domain}")
    print(f"  Origin Type: {origin_type}")
    
    # Step 1: Validate Route53 zone
    print("\n[1] Validating Route53 Zone")
    if not validate_route53_zone(route53_client, zone_id):
        sys.exit(1)
    
    # Step 2: Request ACM certificate
    print("\n[2] Requesting ACM Certificate")
    cert_arn = request_acm_certificate(acm_client, record_name, zone_id)
    if not cert_arn:
        sys.exit(1)
    
    # Step 3: Get validation records
    print("\n[3] Getting Certificate Validation Records")
    validation_record = get_acm_validation_records(acm_client, cert_arn)
    if not validation_record:
        sys.exit(1)
    
    # Step 4: Create validation record in Route53
    print("\n[4] Creating Validation Record in Route53")
    if not create_route53_validation_record(route53_client, zone_id, validation_record):
        sys.exit(1)
    
    # Step 5: Wait for certificate validation
    print("\n[5] Waiting for Certificate Validation")
    if not wait_for_certificate_validation(acm_client, cert_arn):
        sys.exit(1)
    
    # Step 6: Create CloudFront distribution
    print("\n[6] Creating CloudFront Distribution")
    distribution_id, cf_domain = create_cloudfront_distribution(cf_client, record_name, cert_arn, origin_domain, origin_type)
    if not distribution_id:
        sys.exit(1)
    
    # Step 7: Wait for distribution deployment
    print("\n[7] Waiting for Distribution Deployment")
    if not wait_for_distribution_deployment(cf_client, distribution_id):
        print("  Warning: Distribution may still be deploying")
    
    # Step 8: Create DNS A record
    print("\n[8] Creating DNS A Record")
    if not create_route53_record(route53_client, zone_id, record_name, cf_domain):
        sys.exit(1)
    
    # Save deployment info for cleanup
    save_deployment_info(config, cert_arn, distribution_id)
    
    print("\n=== Deployment Complete ===")
    print(f"Domain: {record_name}")
    print(f"CloudFront: {cf_domain}")
    print(f"Certificate: {cert_arn}")
    print(f"Distribution: {distribution_id}")

if __name__ == '__main__':
    main()