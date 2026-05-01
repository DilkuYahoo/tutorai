import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, not_found, forbidden, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Only coaches can manage availability")

    blockout_id = (event.get("pathParameters") or {}).get("blockoutId", "")
    coach_id = get_user_id(event)

    # Find the blockout SK (starts with BLOCKOUT# and contains the id)
    blockouts = db.query_pk(f"COACH#{coach_id}", sk_prefix="BLOCKOUT#")
    target = next((b for b in blockouts if b.get("id") == blockout_id), None)
    if not target:
        return not_found("Blockout not found")

    db.delete_item(f"COACH#{coach_id}", target["SK"])
    return ok({"message": "Blockout removed"})
