import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, not_found, preflight
from shared.auth import require_role
from shared.ids import today
from shared.validation import ValidationError, require_enum, JOB_STATUSES, EMPLOYMENT_TYPES
from shared import db

ALLOWED_FIELDS = {
    "title", "department", "location", "employmentType",
    "salaryMin", "salaryMax", "salaryCurrency", "status", "description", "hiringManagerId",
}


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    job_id = event.get("pathParameters", {}).get("jobId")
    existing = db.get_item(f"JOB#{job_id}", "#META")
    if not existing:
        return not_found(f"Job {job_id} not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    updates = {k: v for k, v in body.items() if k in ALLOWED_FIELDS and v is not None and v != ""}
    if not updates:
        return bad_request("No valid fields to update")

    try:
        if "status" in updates:
            require_enum(updates["status"], JOB_STATUSES, "status")
        if "employmentType" in updates:
            require_enum(updates["employmentType"], EMPLOYMENT_TYPES, "employmentType")
    except ValidationError as e:
        return bad_request(str(e))

    updates["updatedAt"] = today()

    # Update GSI1SK if status changed (prefix must reflect new status)
    if "status" in updates:
        new_status = updates["status"]
        old_gsi_sk = existing.get("GSI1SK", "")
        parts = old_gsi_sk.split("#", 1)
        updates["GSI1SK"] = f"{new_status}#{parts[1]}" if len(parts) == 2 else old_gsi_sk

    updated = db.update_item(f"JOB#{job_id}", "#META", updates)
    job = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(job)
