#!/usr/bin/env python3
"""
Route 53 Zone Import Script

This script imports DNS records from a zone file into Amazon Route 53.
It handles various record types including A, MX, TXT, CNAME records with
proper formatting for each type.

Usage:
    python import_route53_zone.py <HOSTED_ZONE_ID> [ZONE_FILE]

Arguments:
    HOSTED_ZONE_ID: The Route 53 hosted zone ID to import records into
    ZONE_FILE: Path to the zone file (default: utils/advicegenie.com.au)
"""

import boto3
import sys
import re
from typing import Dict, List, Optional, Tuple


class Route53Importer:
    def __init__(self, zone_id: str):
        self.zone_id = zone_id
        self.client = boto3.client("route53")

    def parse_zone_file(self, zone_file_path: str) -> List[Dict]:
        """
        Parse the zone file and return a list of record dictionaries.

        Args:
            zone_file_path: Path to the zone file

        Returns:
            List of record dictionaries ready for Route 53 import
        """
        changes = []

        with open(zone_file_path, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith(';'):
                    continue

                # Parse the line - expected format: name ttl class type value
                parts = line.split('\t')
                if len(parts) < 4:
                    print(f"Warning: Skipping malformed line {line_num}: {line}")
                    continue

                name = parts[0].rstrip('.')
                ttl = parts[1] if len(parts) > 1 and parts[1].isdigit() else '300'
                record_class = parts[2] if len(parts) > 2 else 'IN'
                record_type = parts[3]
                value = parts[4] if len(parts) > 4 else ''

                # Skip system-managed records
                if record_type in ['SOA', 'NS']:
                    print(f"Skipping system-managed {record_type} record: {name}")
                    continue

                # Parse the value based on record type
                try:
                    record_data = self._parse_record_value(record_type, value, name)
                    if record_data:
                        resource_record_set = {
                            'Name': f"{name}.",
                            'Type': record_type,
                            'TTL': int(ttl),
                            **record_data
                        }
                        changes.append({
                            'Action': 'UPSERT',
                            'ResourceRecordSet': resource_record_set
                        })
                except Exception as e:
                    print(f"Error parsing line {line_num}: {line}")
                    print(f"Error: {e}")
                    continue

        return changes

    def _parse_record_value(self, record_type: str, value: str, name: str) -> Optional[Dict]:
        """
        Parse record value based on record type.

        Args:
            record_type: Type of DNS record (A, MX, TXT, etc.)
            value: The record value string
            name: Record name for context

        Returns:
            Dictionary with ResourceRecords or AliasTarget, or None if invalid
        """
        if not value:
            return None

        if record_type == 'A':
            # Simple A record
            return {'ResourceRecords': [{'Value': value}]}

        elif record_type == 'CNAME':
            # CNAME record
            return {'ResourceRecords': [{'Value': value}]}

        elif record_type == 'MX':
            # MX record format: "priority mailserver"
            mx_match = re.match(r'^(\d+)\s+(.+)$', value)
            if mx_match:
                priority, mailserver = mx_match.groups()
                return {'ResourceRecords': [{'Value': f"{priority} {mailserver}"}]}
            else:
                print(f"Warning: Invalid MX record format for {name}: {value}")
                return None

        elif record_type == 'TXT':
            # TXT record - handle quoted values
            if value.startswith('"') and value.endswith('"'):
                # Remove quotes and unescape internal quotes
                txt_value = value[1:-1].replace('""', '"')
                return {'ResourceRecords': [{'Value': f'"{txt_value}"'}]}
            else:
                # Unquoted TXT value
                return {'ResourceRecords': [{'Value': f'"{value}"'}]}

        elif record_type == 'AAAA':
            # IPv6 address
            return {'ResourceRecords': [{'Value': value}]}

        elif record_type == 'SRV':
            # SRV record
            return {'ResourceRecords': [{'Value': value}]}

        elif record_type == 'PTR':
            # PTR record
            return {'ResourceRecords': [{'Value': value}]}

        else:
            # Default handling for other record types
            print(f"Warning: Unhandled record type {record_type} for {name}")
            return {'ResourceRecords': [{'Value': value}]}

    def import_records(self, changes: List[Dict]) -> bool:
        """
        Import records into Route 53.

        Args:
            changes: List of change dictionaries

        Returns:
            True if successful, False otherwise
        """
        if not changes:
            print("No valid records to import")
            return True

        try:
            # Split changes into batches of 1000 (Route 53 limit)
            batch_size = 1000
            for i in range(0, len(changes), batch_size):
                batch = changes[i:i + batch_size]
                print(f"Importing batch {i//batch_size + 1} ({len(batch)} records)...")

                response = self.client.change_resource_record_sets(
                    HostedZoneId=self.zone_id,
                    ChangeBatch={
                        'Changes': batch
                    }
                )

                print(f"Batch {i//batch_size + 1} completed. Change ID: {response['ChangeInfo']['Id']}")

            print(f"✅ Successfully imported {len(changes)} records into Route 53")
            return True

        except Exception as e:
            print(f"❌ Error importing records: {e}")
            return False

    def get_zone_info(self) -> Optional[Dict]:
        """
        Get information about the hosted zone.

        Returns:
            Zone information dictionary or None if error
        """
        try:
            response = self.client.get_hosted_zone(Id=self.zone_id)
            return response['HostedZone']
        except Exception as e:
            print(f"Error getting zone info: {e}")
            return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python import_route53_zone.py <HOSTED_ZONE_ID> [ZONE_FILE]")
        print("Example: python import_route53_zone.py Z123456789 utils/advicegenie.com.au")
        sys.exit(1)

    zone_id = sys.argv[1]
    zone_file = sys.argv[2] if len(sys.argv) > 2 else 'utils/advicegenie.com.au'

    print(f"Route 53 Zone Import Tool")
    print(f"Zone ID: {zone_id}")
    print(f"Zone file: {zone_file}")
    print("-" * 50)

    # Initialize importer
    importer = Route53Importer(zone_id)

    # Get zone info
    zone_info = importer.get_zone_info()
    if zone_info:
        print(f"Target zone: {zone_info['Name']} (ID: {zone_id})")
    else:
        print("Warning: Could not retrieve zone information")
        print("Please verify the zone ID is correct")

    # Parse zone file
    print(f"\nParsing zone file: {zone_file}")
    changes = importer.parse_zone_file(zone_file)

    print(f"Found {len(changes)} valid records to import")

    if not changes:
        print("No records to import. Exiting.")
        return

    # Show summary of what will be imported
    record_types = {}
    for change in changes:
        record_type = change['ResourceRecordSet']['Type']
        record_types[record_type] = record_types.get(record_type, 0) + 1

    print("\nRecords to import by type:")
    for record_type, count in sorted(record_types.items()):
        print(f"  {record_type}: {count}")

    # Confirm import
    confirm = input(f"\nImport {len(changes)} records into Route 53? (y/N): ")
    if confirm.lower() not in ['y', 'yes']:
        print("Import cancelled")
        return

    # Import records
    print("\nStarting import...")
    success = importer.import_records(changes)

    if success:
        print("\n🎉 Zone import completed successfully!")
    else:
        print("\n❌ Zone import failed. Please check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()