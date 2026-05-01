import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import require_role
from shared.response import created, bad_request, preflight
from shared.ids import generate_id, utc_now
from shared.validation import require_fields, ValidationError, PACKAGE_TIERS
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, ["name", "tier", "sessionCount", "price"])
    except ValidationError as e:
        return bad_request(str(e))

    if body["tier"] not in PACKAGE_TIERS:
        return bad_request(f"'tier' must be one of: {', '.join(PACKAGE_TIERS)}")

    pkg_id = generate_id()
    now = utc_now()
    item = {
        "PK": f"PACKAGE#{pkg_id}",
        "SK": "#META",
        "GSI1PK": "PACKAGES",
        "GSI1SK": f"{body['tier']}#{body['name'].lower()}",
        "id": pkg_id,
        "name": body["name"],
        "tier": body["tier"],
        "sessionCount": int(body["sessionCount"]),
        "price": float(body["price"]),
        "description": body.get("description", ""),
        "createdAt": now,
    }
    db.put_item(item)
    out = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return created(out)
