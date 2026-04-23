#!/usr/bin/env python3
"""
ATS Bulk User Onboarding
------------------------
Creates Cognito users in bulk from a CSV file or inline definitions.

Usage:
    # From CSV file
    python bulk_onboard.py --env test --file users.csv

    # Single user inline
    python bulk_onboard.py --env test --name "Sarah Chen" --email sarah@advicelab.com.au --role admin

    # Dry run (no changes made)
    python bulk_onboard.py --env test --file users.csv --dry-run

CSV format (no header required, but supported):
    name,email,role
    Sarah Chen,sarah@advicelab.com.au,admin
    James Okafor,james@advicelab.com.au,hiring_manager

Roles: admin | hiring_manager

The script:
  - Creates each user in the Cognito User Pool with a temporary password
  - Sets custom:role attribute
  - Sends a Cognito welcome email with the temporary password (if SES is configured)
  - Skips users that already exist (will report them)
  - Prints a summary at the end
"""

import argparse
import csv
import io
import os
import random
import string
import sys
import boto3
from botocore.exceptions import ClientError

# ── Config ────────────────────────────────────────────────────────────────────

REGION = "ap-southeast-2"

USER_POOL_IDS = {
    "test": "ap-southeast-2_3EYyw3ciV",
    "prod": "ap-southeast-2_3EYyw3ciV",
}

VALID_ROLES = ["admin", "hiring_manager"]

ROLE_LABELS = {
    "admin":           "Admin (HR)",
    "hiring_manager":  "Hiring Manager",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def temp_password():
    """Generate a secure temporary password that meets Cognito policy (12+ chars, upper, lower, digit)."""
    chars = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(random.choices(chars, k=14))
        if (any(c.isupper() for c in pwd)
                and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd)):
            return pwd


def parse_csv(path):
    users = []
    with open(path, newline="", encoding="utf-8") as f:
        sample = f.read(1024)
        f.seek(0)
        has_header = csv.Sniffer().has_header(sample)
        reader = csv.reader(f)
        if has_header:
            next(reader)
        for i, row in enumerate(reader, start=2 if has_header else 1):
            if not row or all(c.strip() == "" for c in row):
                continue
            if len(row) < 3:
                print(f"  ⚠  Row {i} skipped — expected name,email,role but got: {row}")
                continue
            name, email, role = [c.strip() for c in row[:3]]
            users.append({"name": name, "email": email, "role": role})
    return users


def create_user(client, pool_id, user, dry_run):
    name  = user["name"]
    email = user["email"]
    role  = user["role"]
    pwd   = temp_password()

    if dry_run:
        print(f"  [dry-run] Would create: {name} <{email}> — {ROLE_LABELS.get(role, role)}")
        return "dry_run"

    try:
        client.admin_create_user(
            UserPoolId=pool_id,
            Username=email,
            TemporaryPassword=pwd,
            UserAttributes=[
                {"Name": "name",        "Value": name},
                {"Name": "email",       "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:role", "Value": role},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
        return pwd
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "UsernameExistsException":
            return "exists"
        raise


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Bulk onboard ATS users into Cognito")
    parser.add_argument("--env",      choices=["test", "prod"], default="test",
                        help="Target environment (default: test)")
    parser.add_argument("--file",     help="Path to CSV file (name,email,role)")
    parser.add_argument("--name",     help="Full name (inline mode)")
    parser.add_argument("--email",    help="Email address (inline mode)")
    parser.add_argument("--role",     choices=VALID_ROLES, help="Role (inline mode)")
    parser.add_argument("--dry-run",  action="store_true",
                        help="Preview changes without creating any users")
    args = parser.parse_args()

    # Build user list
    if args.file:
        if not os.path.exists(args.file):
            print(f"Error: file not found: {args.file}")
            sys.exit(1)
        users = parse_csv(args.file)
    elif args.name and args.email and args.role:
        users = [{"name": args.name, "email": args.email, "role": args.role}]
    else:
        parser.print_help()
        print("\nError: provide --file or all of --name, --email, --role")
        sys.exit(1)

    if not users:
        print("No users found to onboard.")
        sys.exit(0)

    # Validate roles
    invalid = [u for u in users if u["role"] not in VALID_ROLES]
    if invalid:
        for u in invalid:
            print(f"  ✗  Invalid role '{u['role']}' for {u['email']} — must be: {', '.join(VALID_ROLES)}")
        sys.exit(1)

    pool_id = USER_POOL_IDS[args.env]
    client  = boto3.client("cognito-idp", region_name=REGION)

    print()
    print(f"  Environment : {args.env}")
    print(f"  User Pool   : {pool_id}")
    print(f"  Users       : {len(users)}")
    print(f"  Dry run     : {'yes' if args.dry_run else 'no'}")
    print()
    print("─" * 60)

    created = []
    skipped = []
    failed  = []

    for user in users:
        label = f"{user['name']} <{user['email']}> [{ROLE_LABELS.get(user['role'], user['role'])}]"
        try:
            result = create_user(client, pool_id, user, args.dry_run)
            if result == "exists":
                print(f"  –  Skipped (already exists): {label}")
                skipped.append(user)
            elif result == "dry_run":
                created.append({**user, "password": "—"})
            else:
                print(f"  ✓  Created: {label}")
                print(f"       Temp password: {result}")
                created.append({**user, "password": result})
        except ClientError as e:
            msg = e.response["Error"]["Message"]
            print(f"  ✗  Failed: {label}")
            print(f"       Error: {msg}")
            failed.append({**user, "error": msg})

    print()
    print("─" * 60)
    print(f"  Created : {len(created)}")
    print(f"  Skipped : {len(skipped)}")
    print(f"  Failed  : {len(failed)}")
    print()

    if failed:
        print("Failed users:")
        for u in failed:
            print(f"  • {u['email']} — {u['error']}")
        print()

    if created and not args.dry_run:
        print("Next steps for each new user:")
        print("  1. They will receive a Cognito welcome email with their temp password")
        print("  2. On first login they will be prompted to set a permanent password")
        print()


if __name__ == "__main__":
    main()
