import sys
sys.path.insert(0, "/opt/python")

import json
import os

import boto3
from botocore.exceptions import ClientError

from shared.response import ok, bad_request, not_found, preflight
from shared.auth import require_role, get_user_name
from shared.ids import utc_now
from shared import db

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
VALID_ROLES  = ["admin", "hiring_manager"]


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

    body = json.loads(event.get("body") or "{}")
    updates = {}

    if "name" in body:
        name = (body["name"] or "").strip()
        if not name:
            return bad_request("name cannot be empty")
        updates["name"] = name
        updates["avatarInitials"] = "".join(p[0].upper() for p in name.split()[:2])

    if "department" in body:
        updates["department"] = (body["department"] or "").strip() or None

    if "role" in body:
        role = (body["role"] or "").strip()
        if role not in VALID_ROLES:
            return bad_request(f"role must be one of: {', '.join(VALID_ROLES)}")
        updates["role"] = role
        # Sync role to Cognito
        cognito = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
        cognito.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=item["email"],
            UserAttributes=[{"Name": "custom:role", "Value": role}],
        )

    if not updates:
        user = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
        return ok(user)

    updates["updatedAt"] = utc_now()
    updated = db.update_item(f"USER#{user_id}", "#META", updates)

    # Audit
    db.put_item({
        "PK": f"AUDIT#{user_id}",
        "SK": f"{utc_now()}#update",
        "action": "update",
        "actor":  get_user_name(event),
        "detail": f"Updated fields: {', '.join(updates.keys())}",
    })

    user = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(user)
