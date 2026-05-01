import json
import os
import sys
import time
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import require_role
from shared.response import ok, bad_request, server_error, preflight

ATHENA_WORKGROUP = "playgenie"
ATHENA_DATABASE = "playgenie"
S3_BUCKET = os.environ.get("S3_BUCKET", "")
S3_PREFIX = os.environ.get("S3_PREFIX", "coachgenie")
_athena = None
_s3 = None


def _get_athena():
    global _athena
    if _athena is None:
        _athena = boto3.client("athena")
    return _athena


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3")
    return _s3


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        body = {}

    date_from = body.get("from", "")
    date_to = body.get("to", "")
    player_id = body.get("playerId", "")
    coach_id = body.get("coachId", "")
    entry_type = body.get("type", "")

    where_clauses = []
    if date_from:
        where_clauses.append(f"date >= '{date_from}'")
    if date_to:
        where_clauses.append(f"date <= '{date_to}'")
    if player_id:
        where_clauses.append(f"player_id = '{player_id}'")
    if coach_id:
        where_clauses.append(f"coach_id = '{coach_id}'")
    if entry_type:
        where_clauses.append(f"type = '{entry_type}'")

    where = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
    query = f"""
        SELECT
            created_at, player_id, player_name, parent_id, coach_id,
            type, delta, balance_available, reference, adjusted_by, note
        FROM {ATHENA_DATABASE}.credit_ledger
        {where}
        ORDER BY created_at DESC
    """

    from shared.ids import generate_id
    export_id = generate_id()
    output_location = f"s3://{S3_BUCKET}/{S3_PREFIX}/exports/{export_id}/"

    start = _get_athena().start_query_execution(
        QueryString=query,
        WorkGroup=ATHENA_WORKGROUP,
        QueryExecutionContext={"Database": ATHENA_DATABASE},
        ResultConfiguration={"OutputLocation": output_location},
    )
    execution_id = start["QueryExecutionId"]

    # Poll up to 50s
    for _ in range(50):
        time.sleep(1)
        status = _get_athena().get_query_execution(QueryExecutionId=execution_id)
        state = status["QueryExecution"]["Status"]["State"]
        if state == "SUCCEEDED":
            break
        if state in ("FAILED", "CANCELLED"):
            return server_error(f"Export query {state}")

    # Generate presigned download URL (15 min)
    key = f"{S3_PREFIX}/exports/{export_id}/{execution_id}.csv"
    download_url = _get_s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key},
        ExpiresIn=900,
    )

    return ok({"downloadUrl": download_url, "exportId": export_id})
