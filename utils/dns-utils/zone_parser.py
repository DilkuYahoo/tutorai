#!/usr/bin/env python3
"""
BIND Zone File Parser and Route53 Converter
============================================

This script parses a BIND zone file and converts it to AWS Route53 format.
It supports A, AAAA, CNAME, TXT, MX, NS, SRV, and SOA records.

Usage:
    python zone_parser.py <zone_file> [--output <output_file>]

Example:
    python zone_parser.py advicelab.com._zone --output route53-zone.json
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from pathlib import Path


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class Record:
    """Represents a DNS record."""
    name: str
    ttl: int
    record_type: str
    value: str
    priority: Optional[int] = None
    port: Optional[int] = None
    weight: Optional[int] = None
    line_number: int = 0
    
    def to_route53_dict(self) -> Dict[str, Any]:
        """Convert to Route53 record set dictionary."""
        resource_records = []
        
        if self.record_type == "SOA":
            # SOA records are handled differently in Route53
            return None
        
        if self.record_type in ["A", "AAAA"]:
            resource_records.append({"Value": self.value})
        elif self.record_type == "CNAME":
            resource_records.append({"Value": self.value})
        elif self.record_type == "TXT":
            # Escape quotes for JSON
            escaped_value = self.value.replace('"', '\\"')
            resource_records.append({"Value": f'"{escaped_value}"'})
        elif self.record_type == "MX":
            resource_records.append({
                "Value": f"{self.priority} {self.value}" if self.priority else self.value
            })
        elif self.record_type == "NS":
            resource_records.append({"Value": self.value})
        elif self.record_type == "SRV":
            resource_records.append({
                "Value": f"{self.weight} {self.port} {self.priority} {self.value}" if self.priority else self.value
            })
        else:
            resource_records.append({"Value": self.value})
        
        return {
            "Name": self.name,
            "Type": self.record_type,
            "TTL": self.ttl,
            "ResourceRecords": resource_records,
        }


@dataclass
class Zone:
    """Represents a DNS zone."""
    origin: str
    soa_record: Optional[Record] = None
    records: List[Record] = field(default_factory=list)
    comments: List[str] = field(default_factory=list)
    
    def to_route53_dict(self) -> Dict[str, Any]:
        """Convert zone to Route53 hosted zone format."""
        record_sets = []
        
        for record in self.records:
            route53_record = record.to_route53_dict()
            if route53_record:
                record_sets.append(route53_record)
        
        return {
            "HostedZone": {
                "Name": self.origin if self.origin.endswith('.') else f"{self.origin}.",
                "CallerReference": f"zone-import-{self.origin}-{int(__import__('time').time())}",
                "Comment": f"Imported from BIND zone file: {self.origin}",
            },
            "RecordSets": record_sets,
        }


# =============================================================================
# PARSER FUNCTIONS
# =============================================================================

def parse_zone_file(filepath: str) -> Zone:
    """
    Parse a BIND zone file and return a Zone object.
    
    Args:
        filepath: Path to the zone file
        
    Returns:
        Zone object with all records
    """
    print(f"[ZONE PARSER] Reading zone file: {filepath}")
    
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    print(f"[ZONE PARSER] Found {len(lines)} lines in zone file")
    
    zone = Zone(origin="")
    
    current_origin = ""
    in_zone_section = False
    
    for line_num, line in enumerate(lines, 1):
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
        
        # Handle comments
        if line.startswith(';'):
            zone.comments.append(line)
            if "$ORIGIN" in line:
                # Extract origin from comment if present
                match = re.search(r'\$ORIGIN\s+(\S+)', line)
                if match:
                    zone.origin = match.group(1)
                    print(f"[ZONE PARSER] Found origin in comment: {zone.origin}")
            continue
        
        # Handle directives
        if line.startswith('$'):
            if line.startswith('$ORIGIN'):
                match = re.match(r'\$ORIGIN\s+(\S+)', line)
                if match:
                    current_origin = match.group(1)
                    if not zone.origin:
                        zone.origin = current_origin
                    print(f"[ZONE PARSER] Set origin: {current_origin}")
            elif line.startswith('$TTL'):
                match = re.match(r'\$TTL\s+(\d+)', line)
                if match:
                    default_ttl = int(match.group(1))
                    print(f"[ZONE PARSER] Default TTL: {default_ttl}")
            continue
        
        # Handle multi-line records (parentheses)
        if '(' in line:
            # Start of multi-line record
            line = line.replace('(', '').strip()
        if ')' in line:
            # End of multi-line record
            line = line.replace(')', '').strip()
        
        # Parse record line
        record = parse_record_line(line, line_num, current_origin)
        if record:
            zone.records.append(record)
            print(f"[ZONE PARSER] Parsed {record.record_type} record: {record.name} -> {record.value}")
    
    print(f"[ZONE PARSER] Total records parsed: {len(zone.records)}")
    
    return zone


def parse_record_line(line: str, line_number: int, default_origin: str) -> Optional[Record]:
    """
    Parse a single DNS record line.
    
    Args:
        line: The record line to parse
        line_number: Line number in the file (for debugging)
        default_origin: Default origin for relative names
        
    Returns:
        Record object or None if line couldn't be parsed
    """
    # Split by whitespace (handle multiple spaces)
    parts = line.split()
    
    if len(parts) < 4:
        print(f"[WARNING] Line {line_number}: Invalid record format: {line}")
        return None
    
    # Extract name (first field, may be @ for origin)
    name = parts[0]
    if name == '@':
        name = default_origin
    elif not name.endswith('.'):
        # Relative name - append origin
        if default_origin:
            name = f"{name}.{default_origin}"
    
    # Extract TTL (second field, optional)
    ttl_str = parts[1]
    try:
        ttl = int(ttl_str)
    except ValueError:
        ttl = 300  # Default TTL if not specified
        ttl_str = "300 (default)"
    
    # Skip the IN keyword if present
    idx = 2
    if parts[idx].upper() == "IN":
        idx += 1
    
    # Extract record type
    record_type = parts[idx].upper()
    idx += 1
    
    # Parse record-specific data
    record_value_parts = parts[idx:]
    record_value_str = ' '.join(record_value_parts)
    
    # Handle parentheses in SOA record
    if '(' in record_value_str:
        record_value_str = record_value_str.replace('(', ' ').replace(')', ' ').strip()
        record_value_parts = record_value_str.split()
        record_value_str = ' '.join(record_value_parts)
    
    # Parse based on record type
    if record_type == "SOA":
        # SOA: name ttl IN SOA ns-server admin-email serial refresh retry expire minimum
        return parse_soa_record(name, ttl, record_value_parts, line_number)
    
    elif record_type == "A":
        # A: name ttl IN A ip-address
        if len(record_value_parts) >= 1:
            return Record(
                name=name,
                ttl=ttl,
                record_type=record_type,
                value=record_value_parts[0],
                line_number=line_number
            )
    
    elif record_type == "AAAA":
        # AAAA: name ttl IN AAAA ipv6-address
        if len(record_value_parts) >= 1:
            return Record(
                name=name,
                ttl=ttl,
                record_type=record_type,
                value=record_value_parts[0],
                line_number=line_number
            )
    
    elif record_type == "CNAME":
        # CNAME: name ttl IN CNAME alias-name
        if len(record_value_parts) >= 1:
            cname = record_value_parts[0]
            if not cname.endswith('.'):
                cname = f"{cname}."
            return Record(
                name=name,
                ttl=ttl,
                record_type=record_type,
                value=cname,
                line_number=line_number
            )
    
    elif record_type == "TXT":
        # TXT: name ttl IN TXT "text-content"
        return Record(
            name=name,
            ttl=ttl,
            record_type=record_type,
            value=record_value_str.strip('"'),
            line_number=line_number
        )
    
    elif record_type == "MX":
        # MX: name ttl IN MX priority exchange
        if len(record_value_parts) >= 2:
            priority = int(record_value_parts[0])
            exchange = record_value_parts[1]
            if not exchange.endswith('.'):
                exchange = f"{exchange}."
            return Record(
                name=name,
                ttl=ttl,
                record_type=record_type,
                value=exchange,
                priority=priority,
                line_number=line_number
            )
    
    elif record_type == "NS":
        # NS: name ttl IN NS nameserver
        if len(record_value_parts) >= 1:
            ns = record_value_parts[0]
            if not ns.endswith('.'):
                ns = f"{ns}."
            return Record(
                name=name,
                ttl=ttl,
                record_type=record_type,
                value=ns,
                line_number=line_number
            )
    
    elif record_type == "SRV":
        # SRV: name ttl IN SRV priority weight port target
        if len(record_value_parts) >= 4:
            priority = int(record_value_parts[0])
            weight = int(record_value_parts[1])
            port = int(record_value_parts[2])
            target = record_value_parts[3]
            if not target.endswith('.'):
                target = f"{target}."
            return Record(
                name=name,
                ttl=ttl,
                record_type=record_type,
                value=target,
                priority=priority,
                weight=weight,
                port=port,
                line_number=line_number
            )
    
    else:
        print(f"[WARNING] Line {line_number}: Unsupported record type: {record_type}")
        return None


def parse_soa_record(name: str, ttl: int, parts: List[str], line_number: int) -> Optional[Record]:
    """Parse an SOA record."""
    if len(parts) < 7:
        print(f"[WARNING] Line {line_number}: Invalid SOA record")
        return None
    
    ns_server = parts[0]
    admin_email = parts[1]
    serial = int(parts[2])
    refresh = int(parts[3])
    retry = int(parts[4])
    expire = int(parts[5])
    minimum = int(parts[6])
    
    # Clean up admin email (replace first dot with @)
    if admin_email.endswith('.'):
        admin_email = admin_email[:-1]
    admin_email = admin_email.replace('.', '@', 1)
    
    print(f"[ZONE PARSER] Parsed SOA record:")
    print(f"  - Nameserver: {ns_server}")
    print(f"  - Admin: {admin_email}")
    print(f"  - Serial: {serial}")
    print(f"  - Refresh: {refresh}s")
    print(f"  - Retry: {retry}s")
    print(f"  - Expire: {expire}s")
    print(f"  - Minimum: {minimum}s")
    
    return Record(
        name=name,
        ttl=ttl,
        record_type="SOA",
        value=f"{ns_server} {admin_email} {serial} {refresh} {retry} {expire} {minimum}",
        line_number=line_number
    )


# =============================================================================
# OUTPUT FUNCTIONS
# =============================================================================

def export_route53_json(zone: Zone, output_file: Optional[str] = None) -> Dict[str, Any]:
    """
    Export zone to Route53 JSON format.
    
    Args:
        zone: Zone object to export
        output_file: Optional file path to write JSON
        
    Returns:
        Dictionary representation for Route53 API
    """
    route53_data = zone.to_route53_dict()
    
    # Add record count summary
    record_counts = {}
    for record in zone.records:
        record_counts[record.record_type] = record_counts.get(record.record_type, 0) + 1
    
    print(f"\n[OUTPUT] Record type summary:")
    for record_type, count in sorted(record_counts.items()):
        print(f"  - {record_type}: {count} records")
    
    if output_file:
        print(f"\n[OUTPUT] Writing Route53 JSON to: {output_file}")
        with open(output_file, 'w') as f:
            json.dump(route53_data, f, indent=2)
        print(f"[OUTPUT] Successfully wrote {len(route53_data['RecordSets'])} records to {output_file}")
    
    return route53_data


def export_bIND_zone(zone: Zone, output_file: Optional[str] = None) -> str:
    """
    Export zone to BIND format.
    
    Args:
        zone: Zone object to export
        output_file: Optional file path to write zone file
        
    Returns:
        String representation of BIND zone file
    """
    lines = []
    lines.append(f"; BIND Zone File for {zone.origin}")
    lines.append(f"; Generated by zone_parser.py")
    lines.append(f"; Origin: {zone.origin}")
    lines.append("")
    lines.append(f"$ORIGIN {zone.origin}.")
    lines.append("")
    
    # SOA record first
    for record in zone.records:
        if record.record_type == "SOA":
            lines.append(f"; SOA Record")
            lines.append(f"@{record.ttl}\tIN\tSOA\t{record.value}")
            lines.append("")
            break
    
    # Other records grouped by type
    record_types = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "SRV"]
    
    for record_type in record_types:
        type_records = [r for r in zone.records if r.record_type == record_type]
        if not type_records:
            continue
        
        lines.append(f"; {record_type} Records")
        for record in type_records:
            if record_type == "A":
                lines.append(f"{record.name}\t{record.ttl}\tIN\tA\t{record.value}")
            elif record_type == "AAAA":
                lines.append(f"{record.name}\t{record.ttl}\tIN\tAAAA\t{record.value}")
            elif record_type == "CNAME":
                lines.append(f"{record.name}\t{record.ttl}\tIN\tCNAME\t{record.value}")
            elif record_type == "TXT":
                lines.append(f'{record.name}\t{record.ttl}\tIN\tTXT\t"{record.value}"')
            elif record_type == "MX":
                lines.append(f"{record.name}\t{record.ttl}\tIN\tMX\t{record.priority}\t{record.value}")
            elif record_type == "NS":
                lines.append(f"{record.name}\t{record.ttl}\tIN\tNS\t{record.value}")
            elif record_type == "SRV":
                lines.append(f"{record.name}\t{record.ttl}\tIN\tSRV\t{record.priority}\t{record.weight}\t{record.port}\t{record.value}")
        lines.append("")
    
    zone_content = '\n'.join(lines)
    
    if output_file:
        print(f"[OUTPUT] Writing BIND zone file to: {output_file}")
        with open(output_file, 'w') as f:
            f.write(zone_content)
        print(f"[OUTPUT] Successfully wrote zone file to {output_file}")
    
    return zone_content


def export_csv(zone: Zone, output_file: Optional[str] = None) -> str:
    """
    Export zone to CSV format.
    
    Args:
        zone: Zone object to export
        output_file: Optional file path to write CSV
        
    Returns:
        String representation of CSV
    """
    lines = ["Name,Type,TTL,Value"]
    
    for record in zone.records:
        if record.record_type == "SOA":
            continue  # Skip SOA in CSV
        
        value = record.value
        if record.record_type == "MX":
            value = f"{record.priority} {value}"
        elif record.record_type == "SRV":
            value = f"{record.priority} {record.weight} {record.port} {value}"
        
        lines.append(f"{record.name},{record.record_type},{record.ttl},\"{value}\"")
    
    csv_content = '\n'.join(lines)
    
    if output_file:
        print(f"[OUTPUT] Writing CSV to: {output_file}")
        with open(output_file, 'w') as f:
            f.write(csv_content)
        print(f"[OUTPUT] Successfully wrote CSV to {output_file}")
    
    return csv_content


# =============================================================================
# AWS ROUTE53 FUNCTIONS
# =============================================================================

def create_route53_hosted_zone(zone: Zone, profile: Optional[str] = None) -> Dict[str, Any]:
    """
    Create a Route53 hosted zone from a Zone object.
    
    Args:
        zone: Zone object to create
        profile: Optional AWS profile name
        
    Returns:
        Response from Route53 API
    """
    import boto3
    
    config = {}
    if profile:
        config["profile_name"] = profile
    
    client = boto3.client('route53', **config)
    
    zone_name = zone.origin if zone.origin.endswith('.') else f"{zone.origin}."
    
    print(f"\n[ROUTE53] Creating hosted zone: {zone_name}")
    
    # Create hosted zone
    response = client.create_hosted_zone(
        Name=zone_name,
        CallerReference=f"zone-import-{zone_name}-{int(__import__('time').time())}",
        HostedZoneConfig={
            'PrivateZone': False,
            'Comment': f"Imported from BIND zone file: {zone.origin}"
        }
    )
    
    hosted_zone_id = response['HostedZone']['Id']
    nameservers = response['DelegationSet']['NameServers']
    
    print(f"[ROUTE53] Created hosted zone: {hosted_zone_id}")
    print(f"[ROUTE53] Name servers:")
    for ns in nameservers:
        print(f"  - {ns}")
    
    return response


def import_records_to_route53(zone: Zone, hosted_zone_id: str, profile: Optional[str] = None) -> Dict[str, Any]:
    """
    Import records into an existing Route53 hosted zone.
    
    Args:
        zone: Zone object with records
        hosted_zone_id: Route53 hosted zone ID
        profile: Optional AWS profile name
        
    Returns:
        Response from Route53 API
    """
    import boto3
    
    config = {}
    if profile:
        config["profile_name"] = profile
    
    client = boto3.client('route53', **config)
    
    # Prepare change batch
    changes = []
    
    for record in zone.records:
        if record.record_type == "SOA":
            continue  # SOA is managed by Route53
        
        route53_record = record.to_route53_dict()
        if route53_record:
            changes.append({
                'Action': 'UPSERT',
                'ResourceRecordSet': route53_record
            })
    
    print(f"\n[ROUTE53] Preparing to import {len(changes)} records...")
    
    # Batch changes (Route53 limits to 100 per request)
    batch_size = 100
    total_batches = (len(changes) + batch_size - 1) // batch_size
    
    all_results = []
    
    for i in range(0, len(changes), batch_size):
        batch = changes[i:i+batch_size]
        batch_num = i // batch_size + 1
        
        print(f"[ROUTE53] Processing batch {batch_num}/{total_batches} ({len(batch)} records)")
        
        try:
            response = client.change_resource_record_sets(
                HostedZoneId=hosted_zone_id,
                ChangeBatch={
                    'Changes': batch,
                    'Comment': f"Imported from BIND zone file"
                }
            )
            
            all_results.append(response)
            print(f"[ROUTE53] Batch {batch_num} submitted successfully")
            
        except Exception as e:
            print(f"[ROUTE53] Error in batch {batch_num}: {e}")
            all_results.append({'error': str(e)})
    
    print(f"\n[ROUTE53] Import complete!")
    
    return all_results


# =============================================================================
# MAIN FUNCTION
# =============================================================================

def main():
    """Main entry point."""
    print("=" * 60)
    print(" BIND Zone File Parser and Route53 Converter")
    print("=" * 60)
    
    parser = argparse.ArgumentParser(
        description="Parse BIND zone files and convert to Route53 format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s zonefile.txt
  %(prog)s zonefile.txt --output route53.json
  %(prog)s zonefile.txt --export bind --output newzone.txt
  %(prog)s zonefile.txt --export csv --output records.csv
  %(prog)s zonefile.txt --create-hosted-zone
  %(prog)s zonefile.txt --import-zone ZXXXXXXXXXXXXX
        """
    )
    
    parser.add_argument('zone_file', nargs='?', help='Path to the zone file')
    parser.add_argument('--output', '-o', help='Output file path')
    parser.add_argument('--export', '-e', choices=['route53', 'bind', 'csv'],
                        default='route53', help='Export format (default: route53)')
    parser.add_argument('--profile', '-p', help='AWS profile name')
    parser.add_argument('--create-hosted-zone', action='store_true',
                        help='Create Route53 hosted zone')
    parser.add_argument('--import-zone', help='Import records to existing Route53 zone ID')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if not args.zone_file:
        parser.print_help()
        sys.exit(1)
    
    # Parse zone file
    zone = parse_zone_file(args.zone_file)
    
    if not zone.records:
        print("[ERROR] No records found in zone file")
        sys.exit(1)
    
    # Export based on format
    if args.export == 'route53':
        output_file = args.output or f"{Path(args.zone_file).stem}-route53.json"
        route53_data = export_route53_json(zone, output_file)
        
        # Optionally create hosted zone
        if args.create_hosted_zone:
            create_route53_hosted_zone(zone, args.profile)
        
        # Optionally import to existing zone
        if args.import_zone:
            import_records_to_route53(zone, args.import_zone, args.profile)
    
    elif args.export == 'bind':
        output_file = args.output or f"{Path(args.zone_file).stem}-new.zone"
        export_bIND_zone(zone, output_file)
    
    elif args.export == 'csv':
        output_file = args.output or f"{Path(args.zone_file).stem}.csv"
        export_csv(zone, output_file)
    
    print("\n" + "=" * 60)
    print(" PARSING COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
