import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import created, bad_request, not_found, preflight
from shared.auth import require_role, get_user_id
from shared.ids import generate_id, utc_now
from shared.validation import ValidationError, require_fields, require_enum, INTERVIEW_TYPES
from shared import db

REQUIRED = ["applicationId", "type", "scheduledAt", "durationMinutes", "panelIds"]


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, REQUIRED)
        require_enum(body["type"], INTERVIEW_TYPES, "type")
    except ValidationError as e:
        return bad_request(str(e))

    application_id = body["applicationId"]
    app = db.get_item(f"APPLICATION#{application_id}", "#META")
    if not app:
        return not_found(f"Application {application_id} not found")

    interview_id = generate_id()
    scheduled_at = body["scheduledAt"]

    item = {
        "PK": f"INTERVIEW#{interview_id}",
        "SK": "#META",
        "GSI1PK": f"APPLICATION#{application_id}",
        "GSI1SK": f"INTERVIEW#{scheduled_at}",
        "GSI2PK": "INTERVIEWS",
        "GSI2SK": f"Scheduled#{scheduled_at}#{interview_id}",
        "id": interview_id,
        "applicationId": application_id,
        "candidateId": app.get("candidateId"),
        "jobId": app.get("jobId"),
        "type": body["type"],
        "scheduledAt": scheduled_at,
        "durationMinutes": int(body["durationMinutes"]),
        "panelIds": body["panelIds"],
        **({ "meetingLink": body["meetingLink"] } if body.get("meetingLink") else {}),
        "status": "Scheduled",
        "createdBy": get_user_id(event),
        "createdAt": utc_now(),
    }

    db.put_item(item)
    return created({"id": interview_id})
