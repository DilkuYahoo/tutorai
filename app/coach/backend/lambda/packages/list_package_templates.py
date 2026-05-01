import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    items = db.query_gsi(index="GSI1", pk_name="GSI1PK", pk_value="PACKAGES")
    out = [{k: v for k, v in p.items() if not k.startswith(("PK", "SK", "GSI"))} for p in items]
    return ok(out)
