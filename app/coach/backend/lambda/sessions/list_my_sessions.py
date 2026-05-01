import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, get_role
from shared.response import ok, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    role = get_role(event)
    user_id = get_user_id(event)
    params = event.get("queryStringParameters") or {}
    status_filter = params.get("status")
    coach_filter = params.get("coachId")

    if role in ("coach", "super_coach"):
        target_coach = coach_filter if (role == "super_coach" and coach_filter) else user_id
        items = db.query_gsi(
            index="GSI1",
            pk_name="GSI1PK",
            pk_value=f"COACH#{target_coach}",
            sk_name="GSI1SK",
            sk_prefix="SESSION#",
            scan_forward=False,
        )
    elif role == "parent":
        # Return sessions for all children
        children = db.query_pk(f"PARENT#{user_id}", sk_prefix="CHILD#")
        items = []
        for child in children:
            player_id = child.get("playerId")
            child_sessions = db.query_gsi(
                index="GSI2",
                pk_name="GSI2PK",
                pk_value=f"PLAYER#{player_id}",
                sk_name="GSI2SK",
                sk_prefix="SESSION#",
                scan_forward=False,
            )
            items.extend(child_sessions)
    else:
        items = db.query_gsi(
            index="GSI2",
            pk_name="GSI2PK",
            pk_value=f"PLAYER#{user_id}",
            sk_name="GSI2SK",
            sk_prefix="SESSION#",
            scan_forward=False,
        )

    if status_filter:
        items = [s for s in items if s.get("status") == status_filter]

    out = [{k: v for k, v in s.items() if not k.startswith(("PK", "SK", "GSI"))} for s in items]
    return ok(out)
