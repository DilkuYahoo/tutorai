import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, forbidden, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Only coaches can manage availability")

    params = event.get("pathParameters") or {}
    date_str = params.get("date", "")
    slot = params.get("slot", "")

    coach_id = get_user_id(event)
    db.delete_item(f"COACH#{coach_id}", f"AVAIL#OVERRIDE#{date_str}#{slot}")
    return ok({"message": "Override removed"})
