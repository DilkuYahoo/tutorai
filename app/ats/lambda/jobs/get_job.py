import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, not_found, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    job_id = event.get("pathParameters", {}).get("jobId")
    if not job_id:
        return not_found("Missing jobId")

    item = db.get_item(f"JOB#{job_id}", "#META")
    if not item:
        return not_found(f"Job {job_id} not found")

    job = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(job)
