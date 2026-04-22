import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import created, bad_request, preflight
from shared.auth import require_role, get_user_id
from shared.ids import generate_id, utc_now, today
from shared.validation import ValidationError, require_fields, require_enum, JOB_STATUSES, EMPLOYMENT_TYPES
from shared import db

REQUIRED = ["title", "employmentType", "status"]


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
        require_enum(body["status"], JOB_STATUSES, "status")
        require_enum(body["employmentType"], EMPLOYMENT_TYPES, "employmentType")
    except ValidationError as e:
        return bad_request(str(e))

    job_id = generate_id()
    now = utc_now()
    status = body["status"]

    item = {
        "PK": f"JOB#{job_id}",
        "SK": "#META",
        "GSI1PK": "JOBS",
        "GSI1SK": f"{status}#{now}#{job_id}",
        "id": job_id,
        "title": body["title"],
        "department": body.get("department", ""),
        "location": body.get("location", ""),
        "employmentType": body["employmentType"],
        **({ "salaryMin": body["salaryMin"] } if body.get("salaryMin") not in (None, "") else {}),
        **({ "salaryMax": body["salaryMax"] } if body.get("salaryMax") not in (None, "") else {}),
        "salaryCurrency": body.get("salaryCurrency", "AUD"),
        "status": status,
        "description": body.get("description", ""),
        "hiringManagerId": body.get("hiringManagerId") or get_user_id(event),
        "applicantCount": 0,
        "createdAt": today(),
        "updatedAt": today(),
        "createdBy": get_user_id(event),
    }

    db.put_item(item)
    return created({"id": job_id})
