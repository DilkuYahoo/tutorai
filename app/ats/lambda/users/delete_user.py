import sys
sys.path.insert(0, "/opt/python")

import os

import boto3

from shared.response import no_content, bad_request, not_found, preflight
from shared.auth import require_role, get_user_id, get_user_name
from shared.ids import utc_now
from shared import db

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin")
    if denied:
        return denied

    user_id   = (event.get("pathParameters") or {}).get("userId", "")
    caller_id = get_user_id(event)

    if caller_id == user_id:
        return bad_request("You cannot delete your own account")

    item = db.get_item(f"USER#{user_id}", "#META")
    if not item:
        return not_found("User not found")

    cognito = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
    cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=item["email"])

    db.delete_item(f"USER#{user_id}", "#META")

    # Audit write — outside the deleted record's PK so it persists
    db.put_item({
        "PK": f"AUDIT#{user_id}",
        "SK": f"{utc_now()}#delete",
        "action": "delete",
        "actor":  get_user_name(event),
        "detail": f"Deleted user {item['email']}",
    })

    return no_content()
