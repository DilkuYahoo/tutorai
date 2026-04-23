import json
import os
import sys
import boto3
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, not_found, preflight
from shared.auth import require_role, get_user_id, get_user_name
from shared.ids import utc_now
from shared.validation import ValidationError, require_fields, require_enum, PIPELINE_STAGES
from shared import db

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

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    app_id = event.get("pathParameters", {}).get("applicationId")
    existing = db.get_item(f"APPLICATION#{app_id}", "#META")
    if not existing:
        return not_found(f"Application {app_id} not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, ["stage"])
        require_enum(body["stage"], PIPELINE_STAGES, "stage")
    except ValidationError as e:
        return bad_request(str(e))

    new_stage = body["stage"]
    note = body.get("note", "")
    now = utc_now()
    actor_id = get_user_id(event)
    actor_name = get_user_name(event)
    job_id = existing.get("jobId")

    # Build new GSI1SK with updated stage prefix
    old_gsi_sk = existing.get("GSI1SK", "")
    parts = old_gsi_sk.split("#", 2)
    new_gsi_sk = f"APP#{new_stage}#{parts[2]}" if len(parts) == 3 else old_gsi_sk

    # History item (separate DynamoDB item)
    history_item = {
        "PK": f"APPLICATION#{app_id}",
        "SK": f"HISTORY#{now}#{new_stage}",
        "stage": new_stage,
        "movedAt": now,
        "movedBy": actor_id,
        "note": note,
    }

    # Audit item
    audit_item = {
        "PK": f"AUDIT#{app_id}",
        "SK": f"{now}#STAGE_MOVED",
        "entityId": app_id,
        "action": "STAGE_MOVED",
        "actorId": actor_id,
        "actorName": actor_name,
        "timestamp": now,
        "detail": f"Stage moved to {new_stage}",
    }

    db.transact_write([
        {
            "Update": {
                "Key": {"PK": f"APPLICATION#{app_id}", "SK": "#META"},
                "UpdateExpression": "SET #stage = :stage, GSI1SK = :gsk",
                "ExpressionAttributeNames": {"#stage": "stage"},
                "ExpressionAttributeValues": {":stage": new_stage, ":gsk": new_gsi_sk},
            }
        },
        {"Put": {"Item": history_item}},
        {"Put": {"Item": audit_item}},
    ])

    # Async notification (fire-and-forget)
    if NOTIFICATION_LAMBDA_ARN:
        candidate = db.get_item(f"CANDIDATE#{existing.get('candidateId')}", "#META")
        job       = db.get_item(f"JOB#{job_id}", "#META") if job_id else None
        job_title = job.get("title", "") if job else ""
        if candidate:
            if new_stage == "Offer":
                template  = "offer"
                variables = {"jobTitle": job_title}
            elif new_stage == "Rejected":
                template  = "rejection"
                variables = {"jobTitle": job_title}
            else:
                template  = "stage_change"
                variables = {"stage": new_stage, "jobTitle": job_title}
            _get_lambda().invoke(
                FunctionName=NOTIFICATION_LAMBDA_ARN,
                InvocationType="Event",
                Payload=json.dumps({
                    "template":       template,
                    "recipientEmail": candidate.get("email"),
                    "recipientName":  f"{candidate.get('firstName')} {candidate.get('lastName')}",
                    "variables":      variables,
                }).encode(),
            )

    return ok({"stage": new_stage, "movedAt": now})
