import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, preflight
from shared.auth import require_role
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    params = event.get("queryStringParameters") or {}
    search = (params.get("search") or "").lower()

    items = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value="CANDIDATES",
        scan_forward=False,
    )

    candidates = []
    for item in items:
        if search:
            full_name = f"{item.get('firstName', '')} {item.get('lastName', '')}".lower()
            email = item.get("email", "").lower()
            if search not in full_name and search not in email:
                continue
        candidates.append({k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))})

    return ok(candidates)
