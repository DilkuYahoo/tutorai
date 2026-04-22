import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, preflight
from shared.auth import require_role
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    params = event.get("queryStringParameters") or {}
    job_id = params.get("jobId")
    candidate_id = params.get("candidateId")
    stage_filter = params.get("stage")

    if job_id:
        items = db.query_gsi(
            index="GSI1",
            pk_name="GSI1PK",
            pk_value=f"JOB#{job_id}",
            sk_name="GSI1SK",
            sk_prefix="APP#",
            scan_forward=False,
        )
    elif candidate_id:
        items = db.query_gsi(
            index="GSI2",
            pk_name="GSI2PK",
            pk_value=f"CANDIDATE#{candidate_id}",
            sk_name="GSI2SK",
            sk_prefix="APP#",
        )
    else:
        return bad_request("Provide jobId or candidateId query parameter")

    applications = []
    for item in items:
        if item.get("SK") != "#META":
            continue
        if stage_filter and item.get("stage") != stage_filter:
            continue
        applications.append({k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))})

    return ok(applications)
