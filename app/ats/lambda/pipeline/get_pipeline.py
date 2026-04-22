import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, preflight
from shared.auth import require_role
from shared.validation import PIPELINE_STAGES
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    params = event.get("queryStringParameters") or {}
    job_id_filter = params.get("jobId")

    # Fetch applications
    if job_id_filter:
        app_items = db.query_gsi(
            index="GSI1",
            pk_name="GSI1PK",
            pk_value=f"JOB#{job_id_filter}",
            sk_name="GSI1SK",
            sk_prefix="APP#",
        )
        app_items = [a for a in app_items if a.get("SK") == "#META"]
    else:
        # Fetch across all stages via GSI2 isn't feasible without a scan.
        # Use per-stage GSI1 queries for all open jobs and merge.
        # For MVP: scan applications with a filter — acceptable at low volume.
        from boto3.dynamodb.conditions import Attr
        resp = db.table().scan(
            FilterExpression=Attr("PK").begins_with("APPLICATION#") & Attr("SK").eq("#META")
        )
        app_items = resp.get("Items", [])

    if not app_items:
        return ok({stage: [] for stage in PIPELINE_STAGES})

    # Batch-resolve candidates and jobs (deduplicate by PK)
    candidate_keys = list({
        f"CANDIDATE#{a['candidateId']}": {"PK": f"CANDIDATE#{a['candidateId']}", "SK": "#META"}
        for a in app_items if a.get("candidateId")
    }.values())
    job_keys = list({
        f"JOB#{a['jobId']}": {"PK": f"JOB#{a['jobId']}", "SK": "#META"}
        for a in app_items if a.get("jobId")
    }.values())

    candidates_by_id = {}
    if candidate_keys:
        for chunk in _chunks(candidate_keys, 100):
            for c in db.batch_get(chunk):
                candidates_by_id[c["id"]] = c

    jobs_by_id = {}
    if job_keys:
        for chunk in _chunks(job_keys, 100):
            for j in db.batch_get(chunk):
                jobs_by_id[j["id"]] = j

    # Group by stage
    board = {stage: [] for stage in PIPELINE_STAGES}
    for app in app_items:
        stage = app.get("stage")
        if stage not in board:
            continue
        candidate = candidates_by_id.get(app.get("candidateId"), {})
        job = jobs_by_id.get(app.get("jobId"), {})
        board[stage].append({
            "appId": app.get("id"),
            "candidateId": app.get("candidateId"),
            "candidateName": f"{candidate.get('firstName', '')} {candidate.get('lastName', '')}".strip(),
            "jobId": app.get("jobId"),
            "jobTitle": job.get("title", ""),
            "fitScore": app.get("fitScore"),
            "appliedAt": app.get("appliedAt"),
        })

    return ok(board)


def _chunks(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]
