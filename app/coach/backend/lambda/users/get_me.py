import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, get_role
from shared.response import ok, not_found, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    user_id = get_user_id(event)
    role = get_role(event)

    prefix_map = {
        "super_coach": "COACH",
        "coach": "COACH",
        "player": "PLAYER",
        "parent": "PARENT",
    }
    prefix = prefix_map.get(role, "PLAYER")
    item = db.get_item(f"{prefix}#{user_id}", "#META")
    if not item:
        return not_found("Profile not found")

    profile = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(profile)
