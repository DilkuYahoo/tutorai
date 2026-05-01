import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, not_found, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    coach_id = (event.get("pathParameters") or {}).get("coachId", "")
    coach = db.get_item(f"COACH#{coach_id}", "#META")
    if not coach or coach.get("status") != "active":
        return not_found("Coach not found")

    params = event.get("queryStringParameters") or {}
    active_only = params.get("active", "true").lower() == "true"

    items = db.query_pk(f"COACH#{coach_id}", sk_prefix="PACKAGE#")
    out = []
    for p in items:
        if active_only and not p.get("active"):
            continue
        out.append({k: v for k, v in p.items() if not k.startswith(("PK", "SK", "GSI"))})
    return ok(out)
