import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, preflight
from shared.auth import require_role
from shared import db
from boto3.dynamodb.conditions import Key


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin")
    if denied:
        return denied

    entity_id = event.get("pathParameters", {}).get("entityId")
    if not entity_id:
        return bad_request("Missing entityId")

    params = event.get("queryStringParameters") or {}
    from_ts = params.get("from")
    to_ts   = params.get("to")

    if from_ts and to_ts:
        resp = db.table().query(
            KeyConditionExpression=
                Key("PK").eq(f"AUDIT#{entity_id}") &
                Key("SK").between(from_ts, to_ts),
            ScanIndexForward=False,
        )
        items = resp.get("Items", [])
    else:
        items = db.query_pk(f"AUDIT#{entity_id}", scan_forward=False)

    entries = [
        {
            "timestamp": e.get("timestamp"),
            "action": e.get("action"),
            "actorId": e.get("actorId"),
            "actorName": e.get("actorName", ""),
            "detail": e.get("detail", ""),
        }
        for e in items
    ]
    return ok(entries)

