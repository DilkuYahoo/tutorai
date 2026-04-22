import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, not_found, preflight
from shared.auth import require_role
from shared.ids import today
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin")
    if denied:
        return denied

    job_id = event.get("pathParameters", {}).get("jobId")
    existing = db.get_item(f"JOB#{job_id}", "#META")
    if not existing:
        return not_found(f"Job {job_id} not found")

    old_gsi_sk = existing.get("GSI1SK", "")
    parts = old_gsi_sk.split("#", 1)
    new_gsi_sk = f"Archived#{parts[1]}" if len(parts) == 2 else old_gsi_sk

    db.update_item(f"JOB#{job_id}", "#META", {
        "status": "Archived",
        "updatedAt": today(),
        "GSI1SK": new_gsi_sk,
    })

    return ok({"id": job_id, "status": "Archived"})
