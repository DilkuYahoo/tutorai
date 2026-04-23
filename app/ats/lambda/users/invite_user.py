import sys
sys.path.insert(0, "/opt/python")

import json
import os
import random
import string

import boto3
from botocore.exceptions import ClientError

from shared.response import ok, created, bad_request, conflict, server_error, preflight
from shared.auth import require_role, get_user_id, get_user_name
from shared.ids import utc_now
from shared import db

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
VALID_ROLES  = ["admin", "hiring_manager"]


def _temp_password():
    chars = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(random.choices(chars, k=14))
        if any(c.isupper() for c in pwd) and any(c.islower() for c in pwd) and any(c.isdigit() for c in pwd):
            return pwd


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin")
    if denied:
        return denied

    body = json.loads(event.get("body") or "{}")
    name       = (body.get("name") or "").strip()
    email      = (body.get("email") or "").strip().lower()
    role       = (body.get("role") or "").strip()
    department = (body.get("department") or "").strip()

    if not name:
        return bad_request("name is required")
    if not email:
        return bad_request("email is required")
    if role not in VALID_ROLES:
        return bad_request(f"role must be one of: {', '.join(VALID_ROLES)}")

    # Check for duplicate email among internal users only (USER# records)
    from boto3.dynamodb.conditions import Attr
    resp = db.table().scan(
        FilterExpression=
            Attr("PK").begins_with("USER#") &
            Attr("SK").eq("#META") &
            Attr("email").eq(email)
    )
    if resp.get("Items"):
        return conflict(f"A user with email '{email}' already exists")

    cognito = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))

    try:
        cog_resp = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            TemporaryPassword=_temp_password(),
            UserAttributes=[
                {"Name": "name",             "Value": name},
                {"Name": "email",            "Value": email},
                {"Name": "email_verified",   "Value": "true"},
                {"Name": "custom:role",      "Value": role},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code == "UsernameExistsException":
            return conflict(f"A Cognito user with email '{email}' already exists")
        raise

    user_id  = cog_resp["User"]["Username"]  # sub UUID returned as Username when email is the alias
    # Cognito may return the sub in Attributes instead
    attrs    = {a["Name"]: a["Value"] for a in cog_resp["User"].get("Attributes", [])}
    user_id  = attrs.get("sub", user_id)

    initials = "".join(p[0].upper() for p in name.split()[:2])

    item = {
        "PK":            f"USER#{user_id}",
        "SK":            "#META",
        "id":            user_id,
        "name":          name,
        "email":         email,
        "role":          role,
        "avatarInitials": initials,
        "department":    department or None,
        "status":        "active",
        "createdAt":     utc_now(),
    }
    db.put_item(item)

    # Audit
    actor = get_user_name(event)
    db.put_item({
        "PK": f"AUDIT#{user_id}",
        "SK": f"{utc_now()}#invite",
        "action": "invite",
        "actor":  actor,
        "detail": f"Invited {email} as {role}",
    })

    user = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return created(user)
