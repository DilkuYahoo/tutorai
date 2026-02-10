#!/usr/bin/env python3
"""
ACM Certificate Manager with DNS Validation
==========================================

This script creates or retrieves an ACM certificate with DNS validation.
It supports wildcard domains and is idempotent (safe to run multiple times).

Features:
- Creates or retrieves existing certificates
- Supports wildcard domains (e.g., *.example.com)
- Automatically creates DNS validation CNAME records in Route53
- Waits for certificate validation and issuance
- Verbose logging throughout
- Idempotent - safe to run multiple times

Usage:
    python acm-cert-manager.py --domain example.com
    python acm-cert-manager.py --domain *.example.com
    python acm-cert-manager.py --domain example.com --region us-east-1
"""

import argparse
import sys
import time
import boto3
from botocore.exceptions import ClientError
from datetime import datetime


# =============================================================================
# LOGGING UTILITIES
# =============================================================================

def log_step(message):
    """Print a step message."""
    print(f"[STEP] {message}")


def log_success(message):
    """Print a success message."""
    print(f"[PASS] ✓ {message}")


def log_warning(message):
    """Print a warning message."""
    print(f"[WARN] ⚠ {message}")


def log_error(message):
    """Print an error message."""
    print(f"[FAIL] ✗ {message}")


def log_info(message):
    """Print an info message."""
    print(f"[INFO] {message}")


def log_section(title):
    """Print a section header."""
    print(f"\n{'=' * 60}")
    print(f" {title}")
    print(f"{'=' * 60}")


# =============================================================================
# ACM CERTIFICATE MANAGER
# =============================================================================

class ACMCertificateManager:
    """Manages ACM certificates with DNS validation."""
    
    ACM_REGION = "us-east-1"  # Required for CloudFront
    
    def __init__(self, domain, region=None, profile=None):
        """
        Initialize the ACM certificate manager.
        
        Args:
            domain: Domain name (e.g., "example.com" or "*.example.com")
            region: AWS region (default: us-east-1 for CloudFront)
            profile: AWS CLI profile name
        """
        self.domain = domain
        self.region = region or self.ACM_REGION
        self.profile = profile
        
        # Initialize AWS clients
        config = {}
        if profile:
            config["profile_name"] = profile
        
        self.acm = boto3.client("acm", region_name=self.region, **config)
        self.route53 = boto3.client("route53", **config)
        
        log_info(f"Initialized ACM Manager for domain: {domain}")
        log_info(f"Region: {self.region}")
        log_info(f"Wildcard: {'Yes' if domain.startswith('*') else 'No'}")
    
    def normalize_domain(self, domain):
        """Normalize domain for ACM (lowercase)."""
        return domain.lower()
    
    def get_certificate_domains(self, domain):
        """Get list of domains for certificate (base domain + wildcard)."""
        normalized = self.normalize_domain(domain)
        domains = [normalized]
        
        # Add wildcard if not already specified
        if not normalized.startswith("*."):
            domains.append(f"*.{normalized}")
        
        return domains
    
    def find_existing_certificate(self, domain):
        """
        Find existing ACM certificate for the domain.
        
        Returns:
            dict with certificate details or None
        """
        normalized_domain = self.normalize_domain(domain)
        
        log_step(f"Searching for existing certificate: {normalized_domain}")
        
        try:
            response = self.acm.list_certificates()
            certificates = response.get("CertificateSummaryList", [])
            
            for cert in certificates:
                cert_arn = cert["CertificateArn"]
                
                # Get certificate details
                cert_detail = self.acm.describe_certificate(CertificateArn=cert_arn)
                cert_info = cert_detail["Certificate"]
                
                # Check domains (subject + SANs)
                subject = cert_info.get("Subject", "").lower()
                sans = cert_info.get("SubjectAlternativeNames", [])
                
                all_domains = [subject] + sans
                
                # Check if any of our domains match
                for target_domain in self.get_certificate_domains(domain):
                    if target_domain.lower() in [d.lower() for d in all_domains]:
                        status = cert_info.get("Status", "UNKNOWN")
                        
                        log_success(f"Found certificate: {cert_arn}")
                        log_info(f"  Status: {status}")
                        log_info(f"  Domains: {', '.join(all_domains)}")
                        
                        return {
                            "arn": cert_arn,
                            "status": status,
                            "domains": all_domains,
                            "cert": cert_info
                        }
            
            log_step(f"No existing certificate found for: {normalized_domain}")
            return None
            
        except ClientError as e:
            log_error(f"Error listing certificates: {e}")
            return None
    
    def request_certificate(self, domain):
        """
        Request a new ACM certificate.
        
        Returns:
            Certificate ARN
        """
        normalized_domain = self.normalize_domain(domain)
        domains = self.get_certificate_domains(domain)
        
        log_step(f"Requesting new certificate for: {', '.join(domains)}")
        
        # For ACM, we need at least one SAN. Include both base and wildcard.
        sans = [d for d in domains if d != normalized_domain]
        if not sans:
            # If wildcard is the primary, add base domain as SAN
            sans = [normalized_domain.replace('*.', '')]
        
        try:
            response = self.acm.request_certificate(
                DomainName=normalized_domain,
                ValidationMethod="DNS",
                SubjectAlternativeNames=sans,
                Options={
                    "CertificateTransparencyLoggingPreference": "ENABLED",
                },
            )
            
            cert_arn = response["CertificateArn"]
            log_success(f"Certificate requested: {cert_arn}")
            
            return cert_arn
            
        except ClientError as e:
            log_error(f"Failed to request certificate: {e}")
            raise
    
    def get_validation_records(self, cert_arn):
        """
        Get DNS validation records for a certificate.
        
        Returns:
            List of dicts with validation details
        """
        log_step(f"Fetching validation records for: {cert_arn}")
        
        try:
            response = self.acm.describe_certificate(CertificateArn=cert_arn)
            cert_info = response["Certificate"]
            
            validation_options = cert_info.get("DomainValidationOptions", [])
            
            if not validation_options:
                log_warning("No domain validation options found")
                return []
            
            records = []
            for option in validation_options:
                if "ResourceRecord" in option:
                    rr = option["ResourceRecord"]
                    records.append({
                        "name": rr["Name"],
                        "type": rr["Type"],
                        "value": rr["Value"],
                        "domain": option.get("DomainName", ""),
                    })
                    
                    log_info(f"Validation record:")
                    log_info(f"  Name:   {rr['Name']}")
                    log_info(f"  Type:   {rr['Type']}")
                    log_info(f"  Value:  {rr['Value']}")
            
            return records
            
        except ClientError as e:
            log_error(f"Failed to get validation records: {e}")
            return []
    
    def get_hosted_zones(self):
        """Get all Route53 hosted zones."""
        log_step("Fetching Route53 hosted zones")
        
        try:
            response = self.route53.list_hosted_zones()
            zones = response.get("HostedZones", [])
            
            for zone in zones:
                log_info(f"  - {zone['Name']} (ID: {zone['Id']})")
            
            return {zone["Name"].rstrip("."): zone for zone in zones}
            
        except ClientError as e:
            log_error(f"Failed to list hosted zones: {e}")
            return {}
    
    def create_validation_record(self, record):
        """
        Create a DNS validation record in Route53.
        
        Args:
            record: Dict with name, type, value
        """
        log_step(f"Creating validation record: {record['name']}")
        
        # Find the hosted zone for this domain
        zones = self.get_hosted_zones()
        
        # Find the longest matching zone
        domain_parts = record["name"].rstrip(".").split(".")
        matching_zone = None
        for i in range(len(domain_parts) - 1):
            potential_zone = ".".join(domain_parts[i:])
            if potential_zone in zones:
                matching_zone = zones[potential_zone]
                break
        
        if not matching_zone:
            # Try to find by suffix match
            for zone_name in zones:
                if record["name"].endswith(zone_name):
                    matching_zone = zones[zone_name]
                    break
        
        if not matching_zone:
            log_error(f"No hosted zone found for: {record['name']}")
            log_warning("Please manually create this DNS record:")
            log_warning(f"  Type: {record['type']}")
            log_warning(f"  Name: {record['name']}")
            log_warning(f"  Value: {record['value']}")
            return False
        
        zone_id = matching_zone["Id"]
        zone_name = matching_zone["Name"]
        
        # Create the record
        log_info(f"Found zone: {zone_name} (ID: {zone_id})")
        
        try:
            # Check if record already exists
            existing = self.route53.list_resource_record_sets(
                HostedZoneId=zone_id,
                StartRecordName=record["name"],
                MaxItems="1"
            )
            
            for rrset in existing.get("ResourceRecordSets", []):
                if rrset["Name"].rstrip(".") == record["name"].rstrip("."):
                    if rrset["Type"] == record["type"]:
                        log_success(f"Record already exists: {record['name']}")
                        return True
            
            # Create the record
            self.route53.change_resource_record_sets(
                HostedZoneId=zone_id,
                ChangeBatch={
                    "Changes": [
                        {
                            "Action": "UPSERT",
                            "ResourceRecordSet": {
                                "Name": record["name"],
                                "Type": record["type"],
                                "TTL": 300,
                                "ResourceRecords": [
                                    {"Value": record["value"]}
                                ],
                            },
                        }
                    ],
                    "Comment": f"ACM Certificate DNS Validation for {self.domain}",
                }
            )
            
            log_success(f"Created validation record: {record['name']}")
            return True
            
        except ClientError as e:
            log_error(f"Failed to create record: {e}")
            return False
    
    def wait_for_validation(self, cert_arn, timeout=600, poll_interval=30):
        """
        Wait for certificate to be issued.
        
        Args:
            cert_arn: Certificate ARN
            timeout: Maximum wait time in seconds
            poll_interval: Poll interval in seconds
            
        Returns:
            True if issued, False otherwise
        """
        log_step(f"Waiting for certificate validation (timeout: {timeout}s)")
        log_info(f"Polling every {poll_interval}s")
        
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = self.acm.describe_certificate(CertificateArn=cert_arn)
                cert_info = response["Certificate"]
                status = cert_info.get("Status", "UNKNOWN")
                
                elapsed = int(time.time() - start_time)
                log_info(f"Status: {status} (elapsed: {elapsed}s)")
                
                if status == "ISSUED":
                    log_success(f"Certificate issued successfully!")
                    
                    # Print certificate details
                    not_before = cert_info.get("NotBefore", "N/A")
                    not_after = cert_info.get("NotAfter", "N/A")
                    log_info(f"Valid from: {not_before}")
                    log_info(f"Valid until: {not_after}")
                    
                    return True
                
                elif status == "PENDING_VALIDATION":
                    # Show validation options if not already done
                    if cert_info.get("DomainValidationOptions"):
                        log_info("DNS validation in progress...")
                    
                elif status == "VALIDATION_TIMED_OUT":
                    log_error("Validation timed out")
                    return False
                
                elif status == "FAILED":
                    failure_reason = cert_info.get("FailureReason", "Unknown")
                    log_error(f"Validation failed: {failure_reason}")
                    return False
                
                # Wait before polling again
                time.sleep(poll_interval)
                
            except ClientError as e:
                log_error(f"Error checking certificate status: {e}")
                time.sleep(poll_interval)
        
        log_error(f"Timeout after {timeout}s")
        return False
    
    def get_or_create_certificate(self):
        """
        Main method to get or create a certificate.
        
        Returns:
            dict with certificate details
        """
        log_section("ACM CERTIFICATE MANAGER")
        log_info(f"Domain: {self.domain}")
        log_info(f"Region: {self.region}")
        log_info(f"Profile: {self.profile or 'default'}")
        
        # Step 1: Check for existing certificate
        existing = self.find_existing_certificate(self.domain)
        
        if existing:
            if existing["status"] == "ISSUED":
                log_success("Certificate already issued and valid!")
                # Normalize to include singular 'domain' key for consistency
                if "domain" not in existing:
                    existing["domain"] = existing["domains"][0] if existing["domains"] else self.domain
                return existing
            
            elif existing["status"] in ["PENDING_VALIDATION", "VALIDATION_TIMED_OUT"]:
                log_warning(f"Certificate exists but status is: {existing['status']}")
                cert_arn = existing["arn"]
            
            else:
                log_warning(f"Certificate exists but status is: {existing['status']}")
                log_step("Requesting new certificate...")
                cert_arn = self.request_certificate(self.domain)
        else:
            # Step 2: Request new certificate
            log_step("No existing certificate found")
            cert_arn = self.request_certificate(self.domain)
        
        # Step 3: Get validation records
        log_section("DNS VALIDATION")
        validation_records = self.get_validation_records(cert_arn)
        
        if not validation_records:
            log_warning("No validation records found - may already be validated")
        
        # Step 4: Create validation records
        for record in validation_records:
            self.create_validation_record(record)
        
        # Step 5: Wait for validation
        log_section("WAITING FOR VALIDATION")
        if validation_records:
            log_info("DNS records created. Waiting for propagation...")
            time.sleep(10)  # Brief pause for DNS to start propagating
        
        if self.wait_for_validation(cert_arn):
            # Get final certificate details
            final_cert = self.acm.describe_certificate(CertificateArn=cert_arn)["Certificate"]
            
            log_section("CERTIFICATE READY")
            log_success(f"Certificate ARN: {cert_arn}")
            log_success(f"Status: {final_cert['Status']}")
            log_success(f"Domain: {final_cert['Subject']}")
            log_info(f"SANs: {', '.join(final_cert.get('SubjectAlternativeNames', []))}")
            
            return {
                "arn": cert_arn,
                "status": final_cert["Status"],
                "domain": final_cert["Subject"],
                "sans": final_cert.get("SubjectAlternativeNames", []),
            }
        else:
            log_error("Certificate validation failed")
            return None
    
    def delete_certificate(self, cert_arn):
        """
        Delete a certificate (for cleanup).
        
        Args:
            cert_arn: Certificate ARN to delete
        """
        log_step(f"Deleting certificate: {cert_arn}")
        
        try:
            self.acm.delete_certificate(CertificateArn=cert_arn)
            log_success("Certificate deleted")
            return True
        except ClientError as e:
            log_error(f"Failed to delete: {e}")
            return False


# =============================================================================
# MAIN FUNCTION
# =============================================================================

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Create and validate ACM certificates with DNS validation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --domain example.com
  %(prog)s --domain "*.example.com"
  %(prog)s --domain example.com --region us-east-1
  %(prog)s --domain example.com --delete-arn "arn:aws:acm:..."
        """
    )
    
    parser.add_argument(
        "--domain", "-d",
        required=True,
        help="Domain name (e.g., example.com or *.example.com)"
    )
    parser.add_argument(
        "--region", "-r",
        default="us-east-1",
        help="AWS region (default: us-east-1 for CloudFront)"
    )
    parser.add_argument(
        "--profile", "-p",
        help="AWS CLI profile name"
    )
    parser.add_argument(
        "--delete-arn",
        help="Delete a certificate by ARN and exit"
    )
    parser.add_argument(
        "--timeout", "-t",
        type=int,
        default=600,
        help="Timeout in seconds for validation (default: 600)"
    )
    parser.add_argument(
        "--poll-interval", "-i",
        type=int,
        default=30,
        help="Poll interval in seconds (default: 30)"
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print(" ACM Certificate Manager with DNS Validation")
    print("=" * 60)
    
    # Handle deletion if requested
    if args.delete_arn:
        manager = ACMCertificateManager(args.domain, args.region, args.profile)
        success = manager.delete_certificate(args.delete_arn)
        sys.exit(0 if success else 1)
    
    # Create certificate
    manager = ACMCertificateManager(args.domain, args.region, args.profile)
    
    # Override timeout and poll interval
    manager.timeout = args.timeout
    manager.poll_interval = args.poll_interval
    
    result = manager.get_or_create_certificate()
    
    if result:
        print("\n" + "=" * 60)
        print(" CERTIFICATE SUMMARY")
        print("=" * 60)
        print(f"ARN:    {result['arn']}")
        print(f"Domain: {result['domain']}")
        print(f"Status: ISSUED")
        
        if result.get('sans'):
            print(f"SANs:  {', '.join(result['sans'])}")
        
        print("\nUse this ARN in your CloudFront configuration:")
        print(f"{result['arn']}")
        print("=" * 60)
        
        sys.exit(0)
    else:
        log_error("Failed to obtain certificate")
        sys.exit(1)


if __name__ == "__main__":
    main()
