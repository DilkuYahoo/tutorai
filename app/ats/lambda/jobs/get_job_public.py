import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, not_found, bad_request, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    job_id = event.get("pathParameters", {}).get("jobId")
    if not job_id:
        return bad_request("Missing jobId")

    item = db.get_item(f"JOB#{job_id}", "#META")
    if not item or item.get("status") == "Archived":
        return not_found(f"Job {job_id} not found")

    PUBLIC_FIELDS = {"id", "title", "department", "location", "employmentType",
                     "salaryMin", "salaryMax", "salaryCurrency", "description",
                     "applicantCount", "createdAt", "status"}

    job = {k: v for k, v in item.items() if k in PUBLIC_FIELDS}
    return ok(job)
