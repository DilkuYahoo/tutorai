import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, not_found, preflight
from shared.auth import require_role, get_user_id, get_user_name
from shared.ids import utc_now
from shared import db

ALLOWED_FIELDS = {"fitScore"}


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    app_id = event.get("pathParameters", {}).get("applicationId")
    existing = db.get_item(f"APPLICATION#{app_id}", "#META")
    if not existing:
        return not_found(f"Application {app_id} not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    updates = {k: v for k, v in body.items() if k in ALLOWED_FIELDS}
    if not updates:
        return bad_request("No valid fields to update")

    if "fitScore" in updates:
        score = updates["fitScore"]
        if not isinstance(score, (int, float)) or not (1 <= score <= 10):
            return bad_request("fitScore must be a number between 1 and 10")
        updates["fitScore"] = int(score)

    updated = db.update_item(f"APPLICATION#{app_id}", "#META", updates)

    if "fitScore" in updates:
        now = utc_now()
        db.put_item({
            "PK":        f"AUDIT#{app_id}",
            "SK":        f"{now}#FIT_SCORE_UPDATED",
            "entityId":  app_id,
            "action":    "FIT_SCORE_UPDATED",
            "actorId":   get_user_id(event),
            "actorName": get_user_name(event),
            "timestamp": now,
            "detail":    f"Fit score set to {updates['fitScore']}",
        })

    result = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(result)
