import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, preflight
from shared.auth import require_role
from shared import db
from boto3.dynamodb.conditions import Attr


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin")
    if denied:
        return denied

    # Scan for internal users (admin + hiring_manager) — low-volume table
    resp = db.table().scan(
        FilterExpression=
            Attr("PK").begins_with("USER#") &
            Attr("SK").eq("#META") &
            Attr("role").is_in(["admin", "hiring_manager"])
    )
    items = resp.get("Items", [])

    users = [
        {
            "id": u.get("id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "role": u.get("role"),
            "department": u.get("department", ""),
            "avatarInitials": u.get("avatarInitials", ""),
            "status": u.get("status", "active"),
        }
        for u in items
    ]
    return ok(users)
