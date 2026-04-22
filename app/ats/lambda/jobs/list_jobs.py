import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, preflight
from shared.auth import require_role
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    # Allow public access to list open jobs (for careers page)
    # Only returns Open jobs, no sensitive data
    params = event.get("queryStringParameters") or {}
    is_public = params.get("public") == "true"
    
    if is_public:
        items = db.query_gsi(
            index="GSI1",
            pk_name="GSI1PK",
            pk_value="JOBS",
            sk_prefix="Open#",
            scan_forward=False,
        )
        jobs = [{k: v for k, v in j.items() if not k.startswith(("PK", "SK", "GSI"))} for j in items]
        return ok(jobs)

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    params = event.get("queryStringParameters") or {}
    status_filter = params.get("status")

    if status_filter:
        # Query GSI1 with status prefix
        items = db.query_gsi(
            index="GSI1",
            pk_name="GSI1PK",
            pk_value="JOBS",
            sk_name="GSI1SK",
            sk_prefix=f"{status_filter}#",
            scan_forward=False,
        )
    else:
        items = db.query_gsi(
            index="GSI1",
            pk_name="GSI1PK",
            pk_value="JOBS",
            scan_forward=False,
        )

    jobs = [_strip_keys(j) for j in items]
    return ok(jobs)


def _strip_keys(item):
    return {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
