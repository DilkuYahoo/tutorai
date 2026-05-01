import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, forbidden, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Only coaches can view availability")

    coach_id = get_user_id(event)

    template = db.get_item(f"COACH#{coach_id}", "AVAIL#TEMPLATE") or {}
    overrides = db.query_pk(f"COACH#{coach_id}", sk_prefix="AVAIL#OVERRIDE#")
    blockouts = db.query_pk(f"COACH#{coach_id}", sk_prefix="BLOCKOUT#")

    def strip(item):
        return {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}

    return ok({
        "template": strip(template),
        "overrides": [strip(o) for o in overrides],
        "blockouts": [strip(b) for b in blockouts],
    })
