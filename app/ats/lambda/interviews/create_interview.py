import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3
from datetime import datetime, timezone

from shared.response import created, bad_request, not_found, preflight
from shared.auth import require_role, get_user_id
from shared.ids import generate_id, utc_now
from shared.validation import ValidationError, require_fields, require_enum, INTERVIEW_TYPES
from shared import db

NOTIFICATION_LAMBDA_ARN = os.environ.get("NOTIFICATION_LAMBDA_ARN", "")

_lambda_client = None

def _get_lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client("lambda")
    return _lambda_client

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

    # Async notification — fire and forget
    if NOTIFICATION_LAMBDA_ARN:
        candidate = db.get_item(f"CANDIDATE#{app.get('candidateId')}", "#META")
        job       = db.get_item(f"JOB#{app.get('jobId')}", "#META")
        if candidate:
            # Format scheduled time for display: "Mon 12 May 2025 at 2:00 PM"
            try:
                dt = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
                dt_str = dt.strftime("%-d %B %Y at %-I:%M %p")
            except Exception:
                dt_str = scheduled_at
            _get_lambda().invoke(
                FunctionName=NOTIFICATION_LAMBDA_ARN,
                InvocationType="Event",
                Payload=json.dumps({
                    "template":       "interview_invite",
                    "recipientEmail": candidate.get("email"),
                    "recipientName":  f"{candidate.get('firstName')} {candidate.get('lastName')}",
                    "variables": {
                        "jobTitle":      job.get("title", "") if job else "",
                        "interviewType": body["type"],
                        "scheduledAt":   dt_str,
                        "meetingLink":   body.get("meetingLink", ""),
                    },
                }).encode(),
            )

    return created({"id": interview_id})
