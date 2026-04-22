import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, not_found, preflight
from shared.auth import require_role
from shared.validation import ValidationError, require_enum, INTERVIEW_STATUSES
from shared import db

ALLOWED_FIELDS = {"scheduledAt", "durationMinutes", "panelIds", "meetingLink", "status"}


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    interview_id = event.get("pathParameters", {}).get("interviewId")
    existing = db.get_item(f"INTERVIEW#{interview_id}", "#META")
    if not existing:
        return not_found(f"Interview {interview_id} not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    updates = {k: v for k, v in body.items() if k in ALLOWED_FIELDS}
    if not updates:
        return bad_request("No valid fields to update")

    try:
        if "status" in updates:
            require_enum(updates["status"], INTERVIEW_STATUSES, "status")
    except ValidationError as e:
        return bad_request(str(e))

    # Update GSI2SK if status or scheduledAt changes
    if "status" in updates or "scheduledAt" in updates:
        new_status = updates.get("status", existing.get("status"))
        new_scheduled = updates.get("scheduledAt", existing.get("scheduledAt"))
        updates["GSI2SK"] = f"{new_status}#{new_scheduled}#{interview_id}"
        if "scheduledAt" in updates:
            updates["GSI1SK"] = f"INTERVIEW#{new_scheduled}"

    updated = db.update_item(f"INTERVIEW#{interview_id}", "#META", updates)
    interview = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(interview)
