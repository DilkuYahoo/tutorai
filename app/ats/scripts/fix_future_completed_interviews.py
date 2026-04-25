#!/usr/bin/env python3
"""
One-off cleanup: reset interviews that are marked Completed/No-show
but have a scheduledAt in the future back to Scheduled.

Usage:
  python fix_future_completed_interviews.py --env prod --dry-run
  python fix_future_completed_interviews.py --env prod
"""
import argparse
import boto3
from datetime import datetime, timezone

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env',     required=True, choices=['test', 'prod'])
    parser.add_argument('--dry-run', action='store_true', help='Print changes without applying them')
    args = parser.parse_args()

    table_name = f'al_ats_{args.env}'
    dynamodb   = boto3.resource('dynamodb', region_name='ap-southeast-2')
    table      = dynamodb.Table(table_name)
    now        = utc_now()

    print(f"Scanning {table_name} for future Completed/No-show interviews...")
    print(f"Current time: {now}")
    if args.dry_run:
        print("DRY RUN — no changes will be made\n")

    # Query GSI2 for all Completed and No-show interviews
    fixed = 0
    for status in ('Completed', 'No-show'):
        response = table.query(
            IndexName='GSI2',
            KeyConditionExpression='GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
            ExpressionAttributeValues={
                ':pk': 'INTERVIEWS',
                ':sk': f'{status}#',
            },
        )
        items = response.get('Items', [])
        print(f"Found {len(items)} {status} interviews")

        for item in items:
            scheduled_at = item.get('scheduledAt', '')
            if scheduled_at > now:
                interview_id = item.get('id', item['PK'].replace('INTERVIEW#', ''))
                print(f"  {'[DRY RUN] Would fix' if args.dry_run else 'Fixing'}: {interview_id} "
                      f"scheduledAt={scheduled_at} status={status} → Scheduled")
                if not args.dry_run:
                    new_gsi2sk = f"Scheduled#{scheduled_at}#{interview_id}"
                    table.update_item(
                        Key={'PK': f'INTERVIEW#{interview_id}', 'SK': '#META'},
                        UpdateExpression='SET #s = :s, GSI2SK = :gsi2sk',
                        ExpressionAttributeNames={'#s': 'status'},
                        ExpressionAttributeValues={
                            ':s':      'Scheduled',
                            ':gsi2sk': new_gsi2sk,
                        },
                    )
                fixed += 1

    print(f"\n{'Would fix' if args.dry_run else 'Fixed'} {fixed} interview(s).")

if __name__ == '__main__':
    main()
