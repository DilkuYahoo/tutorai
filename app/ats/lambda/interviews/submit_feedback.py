import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, not_found, preflight
from shared.auth import require_role, get_user_id
from shared.ids import utc_now
from shared.validation import ValidationError, require_fields, require_enum, FEEDBACK_RECOMMENDATIONS
from shared import db

REQUIRED = ["rating", "recommendation"]


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

    try:
        require_fields(body, REQUIRED)
        require_enum(body["recommendation"], FEEDBACK_RECOMMENDATIONS, "recommendation")
    except ValidationError as e:
        return bad_request(str(e))

    rating = body["rating"]
    if not isinstance(rating, (int, float)) or not (1 <= rating <= 5):
        return bad_request("rating must be a number between 1 and 5")

    now = utc_now()
    feedback = {
        "rating": rating,
        "strengths": body.get("strengths", ""),
        "concerns": body.get("concerns", ""),
        "recommendation": body["recommendation"],
        "submittedBy": get_user_id(event),
        "submittedAt": now,
    }

    # Update GSI2SK to reflect Completed status
    scheduled_at = existing.get("scheduledAt", "")
    new_gsi2_sk = f"Completed#{scheduled_at}#{interview_id}"

    updated = db.update_item(f"INTERVIEW#{interview_id}", "#META", {
        "status": "Completed",
        "feedback": feedback,
        "GSI2SK": new_gsi2_sk,
    })

    interview = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(interview)
