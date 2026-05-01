import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, get_role
from shared.response import ok, not_found, forbidden, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    session_id = (event.get("pathParameters") or {}).get("sessionId", "")
    session = db.get_item(f"SESSION#{session_id}", "#META")
    if not session:
        return not_found("Session not found")

    role = get_role(event)
    user_id = get_user_id(event)

    # Scope check
    if role == "coach" and session.get("coachId") != user_id:
        return forbidden("Not your session")
    if role == "player" and session.get("playerId") != user_id:
        return forbidden("Not your session")
    if role == "parent":
        children = db.query_pk(f"PARENT#{user_id}", sk_prefix="CHILD#")
        child_ids = {c.get("playerId") for c in children}
        if session.get("playerId") not in child_ids:
            return forbidden("Not your child's session")

    comments = db.query_pk(f"SESSION#{session_id}", sk_prefix="COMMENT#")
    videos = db.query_pk(f"SESSION#{session_id}", sk_prefix="VIDEO#")

    def strip(item):
        return {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}

    out = strip(session)
    out["comments"] = [strip(c) for c in comments]
    out["videos"] = [strip(v) for v in videos]
    return ok(out)
