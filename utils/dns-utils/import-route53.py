#!/usr/bin/env python3
"""
Route53 Zone Record Importer
============================

This script imports records from a JSON file into an existing Route53 hosted zone.
"""

import json
import argparse
import sys
from pathlib import Path


def load_records(json_file: str) -> tuple:
    """Load records from JSON file."""
    print(f"[IMPORT] Loading records from: {json_file}")
    
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    record_sets = data.get("RecordSets", [])
    print(f"[IMPORT] Found {len(record_sets)} records to import")
    
    return record_sets


def get_record_type_counts(records: list) -> dict:
    """Get count of records by type."""
    counts = {}
    for record in records:
        record_type = record.get("Type", "UNKNOWN")
        counts[record_type] = counts.get(record_type, 0) + 1
    return counts


def import_records_to_route53(records: list, hosted_zone_id: str, profile: str = None):
    """Import records into Route53 hosted zone."""
    import boto3
    
    config = {}
    if profile:
        config["profile_name"] = profile
    
    client = boto3.client('route53', **config)
    
    # Verify zone exists
    print(f"[IMPORT] Verifying hosted zone: {hosted_zone_id}")
    try:
        zone = client.get_hosted_zone(Id=hosted_zone_id)
        zone_name = zone['HostedZone']['Name']
        print(f"[IMPORT] Found zone: {zone_name}")
    except Exception as e:
        print(f"[ERROR] Zone not found: {e}")
        sys.exit(1)
    
    # Prepare change batch
    changes = []
    
    for record in records:
        if record['Type'] == 'SOA':
            print(f"[IMPORT] Skipping SOA record (managed by Route53)")
            continue
        
        # Build the ResourceRecordSet
        resource_record_set = {
            'Name': record['Name'],
            'Type': record['Type'],
            'TTL': record['TTL'],
            'ResourceRecords': record['ResourceRecords'],
        }
        
        changes.append({
            'Action': 'UPSERT',
            'ResourceRecordSet': resource_record_set
        })
    
    print(f"[IMPORT] Prepared {len(changes)} records for import")
    
    # Get record type summary
    type_counts = get_record_type_counts(records)
    print(f"[IMPORT] Records by type:")
    for record_type, count in sorted(type_counts.items()):
        print(f"  - {record_type}: {count}")
    
    # Batch changes (Route53 limits to 100 per request)
    batch_size = 100
    total_batches = (len(changes) + batch_size - 1) // batch_size
    
    all_results = []
    success_count = 0
    error_count = 0
    
    for i in range(0, len(changes), batch_size):
        batch = changes[i:i+batch_size]
        batch_num = i // batch_size + 1
        
        print(f"\n[IMPORT] Processing batch {batch_num}/{total_batches} ({len(batch)} records)...")
        
        try:
            response = client.change_resource_record_sets(
                HostedZoneId=hosted_zone_id,
                ChangeBatch={
                    'Changes': batch,
                    'Comment': f"Imported from zone file"
                }
            )
            
            status = response.get('ChangeInfo', {}).get('Status', 'UNKNOWN')
            all_results.append(response)
            success_count += len(batch)
            print(f"[IMPORT] Batch {batch_num} submitted successfully (Status: {status})")
            
        except Exception as e:
            error_msg = str(e)
            print(f"[ERROR] Batch {batch_num} failed: {error_msg}")
            all_results.append({'error': error_msg})
            error_count += len(batch)
    
    print(f"\n{'=' * 60}")
    print(f" IMPORT COMPLETE")
    print(f"{'=' * 60}")
    print(f"Total records: {len(changes)}")
    print(f"Successful: {success_count}")
    print(f"Errors: {error_count}")
    
    return all_results


def main():
    parser = argparse.ArgumentParser(
        description="Import records from JSON file to Route53",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s records.json ZXXXXXXXXXXXXX
  %(prog)s advicelab.com-route53.json ZXXXXXXXXXXXXX --profile myprofile
        """
    )
    
    parser.add_argument('json_file', help='Path to the JSON file with records')
    parser.add_argument('hosted_zone_id', help='Route53 hosted zone ID (e.g., ZXXXXXXXXXXXXX)')
    parser.add_argument('--profile', '-p', help='AWS profile name')
    parser.add_argument('--dry-run', action='store_true', help='Show records without importing')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print(" Route53 Zone Record Importer")
    print("=" * 60)
    
    # Load records
    records = load_records(args.json_file)
    
    if not records:
        print("[ERROR] No records found in JSON file")
        sys.exit(1)
    
    # Show summary
    type_counts = get_record_type_counts(records)
    print(f"\n[IMPORT] Records to import:")
    for record_type, count in sorted(type_counts.items()):
        print(f"  - {record_type}: {count}")
    
    if args.dry_run:
        print(f"\n[DRY RUN] Would import {len(records)} records to {args.hosted_zone_id}")
        for record in records:
            print(f"  - {record['Type']} {record['Name']}")
        return
    
    # Import records
    import_records_to_route53(records, args.hosted_zone_id, args.profile)


if __name__ == "__main__":
    main()
