import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.response import created, bad_request, not_found, conflict, preflight
from shared.ids import generate_id, utc_now, today
from shared.validation import ValidationError, require_fields
from shared import db

REQUIRED = ["candidateId", "jobId"]
NOTIFICATION_LAMBDA_ARN = os.environ.get("NOTIFICATION_LAMBDA_ARN", "")

_lambda_client = None

def _get_lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client("lambda")
    return _lambda_client


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, REQUIRED)
    except ValidationError as e:
        return bad_request(str(e))

    candidate_id = body["candidateId"]
    job_id = body["jobId"]

    # Verify job exists and is Open
    job = db.get_item(f"JOB#{job_id}", "#META")
    if not job:
        return not_found(f"Job {job_id} not found")
    if job.get("status") != "Open":
        return bad_request(f"Job is not accepting applications (status: {job.get('status')})")

    # Verify candidate exists
    candidate = db.get_item(f"CANDIDATE#{candidate_id}", "#META")
    if not candidate:
        return not_found(f"Candidate {candidate_id} not found")

    # Prevent duplicate application to same job
    existing = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value=f"JOB#{job_id}",
        sk_name="GSI1SK",
        sk_prefix="APP#",
    )
    for app in existing:
        if app.get("candidateId") == candidate_id:
            return conflict("Candidate has already applied to this job")

    app_id = generate_id()
    now = utc_now()
    date_now = today()

    history_entry = {
        "stage": "Applied",
        "movedAt": now,
        "movedBy": "system",
        "note": "Application received",
    }

    # Application item
    app_item = {
        "PK": f"APPLICATION#{app_id}",
        "SK": "#META",
        "GSI1PK": f"JOB#{job_id}",
        "GSI1SK": f"APP#Applied#{app_id}",
        "GSI2PK": f"CANDIDATE#{candidate_id}",
        "GSI2SK": f"APP#{app_id}",
        "id": app_id,
        "candidateId": candidate_id,
        "jobId": job_id,
        "stage": "Applied",
        "appliedAt": date_now,
        "coverLetterText": body.get("coverLetterText", ""),
    }

    # First stage history item
    history_item = {
        "PK": f"APPLICATION#{app_id}",
        "SK": f"HISTORY#{now}#Applied",
        **history_entry,
    }

    # Audit item
    audit_item = {
        "PK": f"AUDIT#{app_id}",
        "SK": f"{now}#APPLICATION_CREATED",
        "entityId": app_id,
        "action": "APPLICATION_CREATED",
        "actorId": "system",
        "timestamp": now,
        "detail": f"Applied to job {job_id}",
    }

    db.transact_write([
        {"Put": {"Item": app_item}},
        {"Put": {"Item": history_item}},
        {"Put": {"Item": audit_item}},
    ])

    # Increment applicantCount on the job (outside transaction — ADD is safe)
    db.increment(f"JOB#{job_id}", "#META", "applicantCount")

    # Async notification — fire and forget
    if NOTIFICATION_LAMBDA_ARN:
        _get_lambda().invoke(
            FunctionName=NOTIFICATION_LAMBDA_ARN,
            InvocationType="Event",
            Payload=json.dumps({
                "template":       "application_received",
                "recipientEmail": candidate.get("email"),
                "recipientName":  f"{candidate.get('firstName')} {candidate.get('lastName')}",
                "variables":      {"jobTitle": job.get("title", "")},
            }).encode(),
        )

    return created({"id": app_id})
