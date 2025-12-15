#!/usr/bin/env python3
"""
Cleanup Script for DNS Zone Manager
Deletes CloudFront distributions, ACM certificates, and DNS records
"""

import boto3
import json
import time
import sys
from typing import Dict, Optional
from botocore.exceptions import ClientError

def load_deployment_info(deployment_file: str = 'dns_config.json') -> Dict:
    """Load deployment information"""
    try:
        with open(deployment_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Deployment file {deployment_file} not found")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {deployment_file}")
        sys.exit(1)

def get_validation_record_name(acm_client, cert_arn: str) -> Optional[str]:
    """Get the validation record name from ACM certificate"""
    try:
        response = acm_client.describe_certificate(CertificateArn=cert_arn)
        options = response['Certificate'].get('DomainValidationOptions', [])
        
        if options and 'ResourceRecord' in options[0]:
            return options[0]['ResourceRecord']['Name']
        
        return None
    except ClientError as e:
        print(f"  Warning: Could not retrieve validation record name: {e}")
        return None

def delete_route53_record(route53_client, zone_id: str, record_name: str, record_type: str = 'A') -> bool:
    """Delete Route53 record"""
    try:
        # First, get the record to see if it exists and what it points to
        response = route53_client.list_resource_record_sets(
            HostedZoneId=zone_id,
            StartRecordName=record_name,
            StartRecordType=record_type,
            MaxItems='1'
        )
        
        if not response['ResourceRecordSets']:
            print(f"  Record {record_name} not found, skipping")
            return True
        
        record_set = response['ResourceRecordSets'][0]
        
        # Check if this is the right record
        if record_set['Name'].rstrip('.') != record_name.rstrip('.'):
            print(f"  Record {record_name} not found, skipping")
            return True
        
        # Delete the record
        route53_client.change_resource_record_sets(
            HostedZoneId=zone_id,
            ChangeBatch={
                'Changes': [{
                    'Action': 'DELETE',
                    'ResourceRecordSet': record_set
                }]
            }
        )
        print(f"✓ Deleted DNS record: {record_name}")
        return True
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'InvalidChangeBatch':
            print(f"  Record {record_name} not found or already deleted")
            return True
        print(f"✗ Failed to delete DNS record: {e}")
        return False

def delete_validation_record(route53_client, zone_id: str, validation_name: str) -> bool:
    """Delete ACM validation CNAME record"""
    try:
        response = route53_client.list_resource_record_sets(
            HostedZoneId=zone_id,
            StartRecordName=validation_name,
            StartRecordType='CNAME',
            MaxItems='1'
        )
        
        if not response['ResourceRecordSets']:
            print(f"  Validation record not found, skipping")
            return True
        
        record_set = response['ResourceRecordSets'][0]
        
        if record_set['Name'].rstrip('.') != validation_name.rstrip('.'):
            print(f"  Validation record not found, skipping")
            return True
        
        route53_client.change_resource_record_sets(
            HostedZoneId=zone_id,
            ChangeBatch={
                'Changes': [{
                    'Action': 'DELETE',
                    'ResourceRecordSet': record_set
                }]
            }
        )
        print(f"✓ Deleted validation record: {validation_name}")
        return True
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'InvalidChangeBatch':
            print(f"  Validation record not found or already deleted")
            return True
        print(f"  Warning: Could not delete validation record: {e}")
        return True  # Continue cleanup even if validation record fails

def disable_cloudfront_distribution(cf_client, distribution_id: str) -> bool:
    """Disable CloudFront distribution before deletion"""
    try:
        # Get current config
        response = cf_client.get_distribution_config(Id=distribution_id)
        config = response['DistributionConfig']
        etag = response['ETag']
        
        # Check if already disabled
        if not config['Enabled']:
            print(f"  Distribution already disabled")
            return True
        
        # Disable it
        config['Enabled'] = False
        cf_client.update_distribution(
            Id=distribution_id,
            DistributionConfig=config,
            IfMatch=etag
        )
        
        print(f"✓ CloudFront distribution disabled: {distribution_id}")
        return True
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchDistribution':
            print(f"  Distribution not found, skipping")
            return True
        print(f"✗ Failed to disable distribution: {e}")
        return False

def wait_for_distribution_disabled(cf_client, distribution_id: str, timeout: int = 600) -> bool:
    """Wait for CloudFront distribution to be fully disabled"""
    print("  Waiting for distribution to be disabled (this may take several minutes)...")
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        try:
            response = cf_client.get_distribution(Id=distribution_id)
            status = response['Distribution']['Status']
            
            if status == 'Deployed':
                print(f"  Distribution disabled and deployed")
                return True
            
            time.sleep(15)
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchDistribution':
                return True
            print(f"✗ Error checking distribution status: {e}")
            return False
    
    print("✗ Timeout waiting for distribution to be disabled")
    return False

def delete_cloudfront_distribution(cf_client, distribution_id: str) -> bool:
    """Delete CloudFront distribution"""
    try:
        # Get ETag for deletion
        response = cf_client.get_distribution(Id=distribution_id)
        etag = response['ETag']
        
        cf_client.delete_distribution(
            Id=distribution_id,
            IfMatch=etag
        )
        
        print(f"✓ CloudFront distribution deleted: {distribution_id}")
        return True
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchDistribution':
            print(f"  Distribution not found, skipping")
            return True
        if e.response['Error']['Code'] == 'DistributionNotDisabled':
            print(f"✗ Distribution must be disabled before deletion")
            return False
        print(f"✗ Failed to delete distribution: {e}")
        return False

def delete_acm_certificate(acm_client, cert_arn: str) -> bool:
    """Delete ACM certificate"""
    try:
        acm_client.delete_certificate(CertificateArn=cert_arn)
        print(f"✓ ACM certificate deleted: {cert_arn}")
        return True
        
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"  Certificate not found, skipping")
            return True
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"✗ Certificate still in use by CloudFront distribution")
            return False
        print(f"✗ Failed to delete certificate: {e}")
        return False

def verify_cleanup(route53_client, cf_client, acm_client, deployment_info: Dict) -> bool:
    """Verify all resources have been cleaned up"""
    all_clean = True
    
    print("\n=== Verification ===")
    
    # Check Route53 record
    try:
        response = route53_client.list_resource_record_sets(
            HostedZoneId=deployment_info['zone_id'],
            StartRecordName=deployment_info['record_name'],
            StartRecordType='A',
            MaxItems='1'
        )
        
        if response['ResourceRecordSets']:
            record = response['ResourceRecordSets'][0]
            if record['Name'].rstrip('.') == deployment_info['record_name'].rstrip('.'):
                print(f"✗ DNS record still exists: {deployment_info['record_name']}")
                all_clean = False
            else:
                print(f"✓ DNS record deleted")
        else:
            print(f"✓ DNS record deleted")
            
    except ClientError:
        print(f"✓ DNS record deleted")
    
    # Check CloudFront distribution
    try:
        cf_client.get_distribution(Id=deployment_info['distribution_id'])
        print(f"✗ CloudFront distribution still exists: {deployment_info['distribution_id']}")
        all_clean = False
    except ClientError as e:
        if e.response['Error']['Code'] == 'NoSuchDistribution':
            print(f"✓ CloudFront distribution deleted")
        else:
            print(f"? Could not verify CloudFront deletion")
    
    # Check ACM certificate
    try:
        acm_client.describe_certificate(CertificateArn=deployment_info['certificate_arn'])
        print(f"✗ ACM certificate still exists: {deployment_info['certificate_arn']}")
        all_clean = False
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print(f"✓ ACM certificate deleted")
        else:
            print(f"? Could not verify ACM deletion")
    
    return all_clean

def main():
    print("=== DNS Zone Cleanup Script ===\n")
    
    # Load deployment info
    deployment_info = load_deployment_info()
    
    print("Resources to clean up:")
    print(f"  Zone ID: {deployment_info['zone_id']}")
    print(f"  Record: {deployment_info['record_name']}")
    print(f"  Distribution: {deployment_info['distribution_id']}")
    print(f"  Certificate: {deployment_info['certificate_arn']}")
    
    # Confirm cleanup
    response = input("\nProceed with cleanup? (yes/no): ")
    if response.lower() != 'yes':
        print("Cleanup cancelled")
        sys.exit(0)
    
    # Initialize AWS clients
    # ACM must be in us-east-1 for CloudFront (global requirement)
    # Other services use ap-southeast-2 (Sydney)
    acm_client = boto3.client('acm', region_name='us-east-1')
    cf_client = boto3.client('cloudfront', region_name='ap-southeast-2')
    route53_client = boto3.client('route53', region_name='ap-southeast-2')
    
    # Step 1: Delete DNS A record
    print("\n[1] Deleting DNS A Record")
    delete_route53_record(
        route53_client,
        deployment_info['zone_id'],
        deployment_info['record_name']
    )
    
    # Step 2: Get and delete validation record
    print("\n[2] Deleting ACM Validation Record")
    validation_name = get_validation_record_name(acm_client, deployment_info['certificate_arn'])
    if validation_name:
        delete_validation_record(route53_client, deployment_info['zone_id'], validation_name)
    
    # Step 3: Disable CloudFront distribution
    print("\n[3] Disabling CloudFront Distribution")
    if disable_cloudfront_distribution(cf_client, deployment_info['distribution_id']):
        wait_for_distribution_disabled(cf_client, deployment_info['distribution_id'])
    
    # Step 4: Delete CloudFront distribution
    print("\n[4] Deleting CloudFront Distribution")
    delete_cloudfront_distribution(cf_client, deployment_info['distribution_id'])
    
    # Step 5: Delete ACM certificate
    print("\n[5] Deleting ACM Certificate")
    # Wait a bit for CloudFront to fully release the certificate
    time.sleep(5)
    delete_acm_certificate(acm_client, deployment_info['certificate_arn'])
    
    # Step 6: Verify cleanup
    if verify_cleanup(route53_client, cf_client, acm_client, deployment_info):
        print("\n✓ All resources successfully cleaned up")
    else:
        print("\n⚠ Some resources may still exist. Please check AWS Console.")
    
    print("\n=== Cleanup Complete ===")

if __name__ == '__main__':
    main()