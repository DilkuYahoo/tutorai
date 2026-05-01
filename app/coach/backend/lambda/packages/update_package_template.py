import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import require_role
from shared.response import ok, bad_request, not_found, preflight
from shared.ids import utc_now
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    pkg_id = (event.get("pathParameters") or {}).get("packageId", "")
    pkg = db.get_item(f"PACKAGE#{pkg_id}", "#META")
    if not pkg:
        return not_found("Package template not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    allowed = ["name", "price", "description", "sessionCount"]
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return bad_request("No valid fields to update")

    updates["updatedAt"] = utc_now()
    if "name" in updates:
        updates["GSI1SK"] = f"{pkg.get('tier')}#{updates['name'].lower()}"

    updated = db.update_item(f"PACKAGE#{pkg_id}", "#META", updates)
    out = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(out)
