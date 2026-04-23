import sys
sys.path.insert(0, "/opt/python")

import os

import boto3

from shared.response import ok, not_found, preflight
from shared.auth import require_role, get_user_name
from shared.ids import utc_now
from shared import db

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin")
    if denied:
        return denied

    user_id = (event.get("pathParameters") or {}).get("userId", "")
    item    = db.get_item(f"USER#{user_id}", "#META")
    if not item:
        return not_found("User not found")

    cognito = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
    cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=item["email"])

    updated = db.update_item(f"USER#{user_id}", "#META", {"status": "active", "updatedAt": utc_now()})

    db.put_item({
        "PK": f"AUDIT#{user_id}",
        "SK": f"{utc_now()}#enable",
        "action": "enable",
        "actor":  get_user_name(event),
        "detail": f"Enabled user {item['email']}",
    })

    user = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(user)
