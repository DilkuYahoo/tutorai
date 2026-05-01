import json
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timezone

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, bad_request, not_found, forbidden, preflight
from shared.ids import utc_now
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Only coaches can update session venue")

    session_id = (event.get("pathParameters") or {}).get("sessionId", "")
    session = db.get_item(f"SESSION#{session_id}", "#META")
    if not session:
        return not_found("Session not found")

    caller_id = get_user_id(event)
    if session.get("coachId") != caller_id:
        return forbidden("Not your session")

    scheduled_at = datetime.fromisoformat(session["scheduledAt"])
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) >= scheduled_at:
        return bad_request("Venue cannot be updated after session start time")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    venue = (body.get("venue") or "").strip()
    if not venue:
        return bad_request("'venue' is required")

    db.update_item(f"SESSION#{session_id}", "#META", {"venue": venue, "venueUpdatedAt": utc_now()})
    return ok({"message": "Venue updated", "venue": venue})
