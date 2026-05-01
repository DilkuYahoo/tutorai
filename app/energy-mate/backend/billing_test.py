"""Standalone billing test utility for validating interval data costs and earnings.

This module provides a function to sum costsAll (import cost) and earningsAll (export earnings)
separately for yesterday's intervals, similar to what get_history.py does.

Can be called from the Django shell or as a standalone script.

Usage (Django shell):
    python manage.py shell -c "from app.energy_mate.backend.billing_test import test_yesterday_billing; test_yesterday_billing()"

Or with a specific NMI:
    python manage.py shell -c "from app.energy_mate.backend.billing_test import test_yesterday_billing; test_yesterday_billing(nmi='your_nmi_here')"

Or from a bash cron job:
    cd /path/to/energy-mate/backend && python billing_test.py
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import sys
import os

# Add shared path so this can run standalone (similar to get_history.py)
try:
    from shared import db
except ImportError:
    # When running standalone (not as lambda), mock the db module
    class MockDB:
        def query_pk_between(self, pk, sk_start, sk_end, scan_forward=True):
            # Placeholder - would need proper DynamoDB setup
            print(f"Query: PK={pk}, SK between {sk_start} and {sk_end}")
            return []
    
    # Create a mock db module
    import types
    db = types.ModuleType('db')
    db.query_pk_between = MockDB().query_pk_between

# If running in the energy-mate backend lambda context, use the real shared db
try:
    sys.path.insert(0, '/opt/python')
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lambda', 'shared'))
    from shared import db as lambda_db
    db = lambda_db
except (ImportError, ModuleNotFoundError):
    # Not running in lambda context, db may need proper setup
    pass


def _to_float(val) -> float | None:
    """Convert value to float, handling None/N/A like get_history.py does."""
    if val is None or val == "N/A":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _get_aest_day_bounds(aest_dt, offset=timedelta(hours=10)):
    """Return UTC ISO strings for start and end of given AEST datetime's day.
    
    Args:
        aest_dt: A datetime in AEST timezone (naive or aware)
        offset: AEST offset from UTC (default 10 hours)
    
    Returns:
        Tuple of (start_utc_iso, end_utc_iso)
    """
    if aest_dt.tzinfo is not None:
        aest_dt = aest_dt.astimezone(timezone.utc).replace(tzinfo=None) + offset
    start_aest = aest_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    end_aest = start_aest + timedelta(days=1)
    start_utc = start_aest - offset
    end_utc = end_aest - offset
    return start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"), end_utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def get_yesterday_billing(nmi=None, db_table=None):
    """Calculate yesterday's billing totals for costsAll and earningsAll.
    
    This mimics the billing aggregation logic from get_history.py for yesterday's data.
    It queries DynamoDB for INTERVAL records for the given NMI over yesterday's day
    (AEST timezone) and sums the costsAll and earningsAll fields.
    
    Args:
        nmi: The NMI identifier. If None, reads from NMI env var or SSM param.
        db_table: Optional DynamoDB table resource. If None, uses db module.
    
    Returns:
        Dict with:
            - 'spend_cents': Sum of costsAll (in cents)
            - 'earn_cents': Sum of earningsAll (in cents)
            - 'net_cents': Net (spend - earn) in cents
            - 'item_count': Number of interval records found
    """
    # Try to get NMI if not provided
    if nmi is None:
        nmi = os.environ.get("NMI")
    
    if nmi is None:
        # Try boto3 SSM like get_history.py
        try:
            import boto3
            ssm = boto3.client("ssm", region_name="ap-southeast-2")
            resp = ssm.get_parameter(Name="/energy-mate/nmi")
            nmi = resp["Parameter"]["Value"]
        except (ImportError, Exception):
            raise ValueError("NMI must be provided or set in NMI env var or SSM")
    
    now_utc = datetime.now(timezone.utc)
    now_aest = now_utc + timedelta(hours=10)
    
    # Calculate yesterday's bounds (AEST)
    yesterday_aest = now_aest - timedelta(days=1)
    yesterday_start, yesterday_end = _get_aest_day_bounds(yesterday_aest)
    
    # Query items
    if db_table is not None:
        # Use provided table resource directly
        items = []
        kwargs = {
            'KeyConditionExpression': __import__('boto3.dynamodb.conditions', 
                fromlist=['Key']).Key('PK').eq(f"INTERVAL#{nmi}") &
                    __import__('boto3.dynamodb.conditions', 
                        fromlist=['Key']).Key('SK').between(yesterday_start, yesterday_end),
            'ScanIndexForward': True,
        }
        table = db_table
    elif hasattr(db, 'query_pk_between'):
        # Use the shared db module
        items = db.query_pk_between(f"INTERVAL#{nmi}", yesterday_start, yesterday_end)
    else:
        raise RuntimeError("No valid DB interface available. Provide db_table or set up shared.db")
    
    # Sum costsAll and earningsAll
    spend_cents = sum(_to_float(item.get("costsAll")) or 0 for item in items)
    earn_cents = sum(_to_float(item.get("earningsAll")) or 0 for item in items)
    
    return {
        'period': 'yesterday',
        'date_aest': yesterday_aest.strftime('%Y-%m-%d'),
        'start_utc': yesterday_start,
        'end_utc': yesterday_end,
        'item_count': len(items),
        'spend_cents': round(spend_cents, 2),
        'earn_cents': round(earn_cents, 2),
        'net_cents': round(spend_cents - earn_cents, 2),
        'spend_dollars': round(spend_cents / 100, 2),
        'earn_dollars': round(earn_cents / 100, 2),
        'net_dollars': round((spend_cents - earn_cents) / 100, 2),
    }


def test_yesterday_billing(nmi=None):
    """Run the billing test and print results.
    
    Args:
        nmi: Optional NMI string. If not provided, uses NMI env var.
    """
    try:
        results = get_yesterday_billing(nmi=nmi)
        print("=" * 60)
        print("Yesterday's Billing Summary (from get_history-style query)")
        print("=" * 60)
        print(f"Period:    {results['period']} ({results['date_aest']})")
        print(f"UTC Start: {results['start_utc']}")
        print(f"UTC End:   {results['end_utc']}")
        print(f"Items:     {results['item_count']}")
        print("-" * 60)
        print(f"Spend:     {results['spend_cents']:>10.2f} cents  ({results['spend_dollars']:>8.2f} AUD)")
        print(f"Earn:      {results['earn_cents']:>10.2f} cents  ({results['earn_dollars']:>8.2f} AUD)")
        print(f"Net:       {results['net_cents']:>10.2f} cents  ({results['net_dollars']:>8.2f} AUD)")
        print("=" * 60)
        return results
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    # When run as a script
    test_yesterday_billing()
