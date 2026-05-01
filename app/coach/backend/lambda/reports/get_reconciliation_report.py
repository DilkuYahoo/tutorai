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
_athena = None


def _get_athena():
    global _athena
    if _athena is None:
        _athena = boto3.client("athena")
    return _athena


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    params = event.get("queryStringParameters") or {}
    date_from = params.get("from", "")
    date_to = params.get("to", "")
    player_id = params.get("playerId", "")
    coach_id = params.get("coachId", "")
    entry_type = params.get("type", "")

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
        LIMIT 1000
    """

    start = _get_athena().start_query_execution(
        QueryString=query,
        WorkGroup=ATHENA_WORKGROUP,
        QueryExecutionContext={"Database": ATHENA_DATABASE},
        ResultConfiguration={
            "OutputLocation": f"s3://{S3_BUCKET}/athena-results/reconciliation/"
        },
    )
    execution_id = start["QueryExecutionId"]

    # Poll (max 25s — within Lambda timeout)
    for _ in range(25):
        time.sleep(1)
        status = _get_athena().get_query_execution(QueryExecutionId=execution_id)
        state = status["QueryExecution"]["Status"]["State"]
        if state == "SUCCEEDED":
            break
        if state in ("FAILED", "CANCELLED"):
            return server_error(f"Athena query {state}")

    results = _get_athena().get_query_results(QueryExecutionId=execution_id)
    rows = results.get("ResultSet", {}).get("Rows", [])
    if not rows:
        return ok({"rows": [], "totals": {}})

    headers = [c["VarCharValue"] for c in rows[0]["Data"]]
    data = []
    for row in rows[1:]:
        values = [c.get("VarCharValue", "") for c in row["Data"]]
        data.append(dict(zip(headers, values)))

    # Summary totals
    purchased = sum(int(r.get("delta", 0)) for r in data if r.get("type") == "purchase")
    consumed = abs(sum(int(r.get("delta", 0)) for r in data if r.get("type") == "session_complete"))
    returned = sum(int(r.get("delta", 0)) for r in data if r.get("type") == "cancellation_return")
    adjusted = sum(int(r.get("delta", 0)) for r in data if r.get("type") == "manual_adjustment")

    return ok({
        "rows": data,
        "totals": {
            "purchased": purchased,
            "consumed": consumed,
            "returned": returned,
            "adjusted": adjusted,
        },
    })
