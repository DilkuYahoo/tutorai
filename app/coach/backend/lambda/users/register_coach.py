import json
import os
import random
import string
import sys
sys.path.insert(0, "/opt/python")

import boto3
from botocore.exceptions import ClientError

from shared.auth import require_role, get_user_name
from shared.response import created, bad_request, conflict, preflight
from shared.ids import generate_id, utc_now
from shared.validation import require_fields, ValidationError
from shared import db

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")
NOTIFICATION_FUNCTION_NAME = os.environ.get("NOTIFICATION_FUNCTION_NAME", "")

_lambda_client = None
_cognito_client = None


def _cognito():
    global _cognito_client
    if _cognito_client is None:
        _cognito_client = boto3.client("cognito-idp")
    return _cognito_client


def _lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client("lambda")
    return _lambda_client


def _temp_password():
    chars = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(random.choices(chars, k=14))
        if (any(c.isupper() for c in pwd) and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd)):
            return pwd


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, ["name", "email", "rate"])
    except ValidationError as e:
        return bad_request(str(e))

    name = body["name"].strip()
    email = body["email"].strip().lower()
    rate = body.get("rate")
    bio = body.get("bio", "")
    social_links = body.get("socialLinks", {})

    try:
        resp = _cognito().admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            TemporaryPassword=_temp_password(),
            UserAttributes=[
                {"Name": "name", "Value": name},
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:role", "Value": "coach"},
            ],
            DesiredDeliveryMediums=["EMAIL"],
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "UsernameExistsException":
            return conflict(f"A user with email '{email}' already exists")
        raise

    attrs = {a["Name"]: a["Value"] for a in resp["User"].get("Attributes", [])}
    coach_id = attrs.get("sub", resp["User"]["Username"])

    item = {
        "PK": f"COACH#{coach_id}",
        "SK": "#META",
        "GSI1PK": "COACHES",
        "GSI1SK": f"active#{name.lower()}",
        "id": coach_id,
        "name": name,
        "email": email,
        "rate": rate,
        "bio": bio,
        "socialLinks": social_links,
        "photoUrl": None,
        "status": "active",
        "role": "coach",
        "createdAt": utc_now(),
        "videoReviewFlag": False,
    }
    db.put_item(item)

    actor = get_user_name(event)
    db.put_item({
        "PK": f"AUDIT#{coach_id}",
        "SK": f"{utc_now()}#coach_registered",
        "action": "coach_registered",
        "actor": actor,
        "detail": f"Registered coach {email}",
    })

    try:
        _lambda().invoke(
            FunctionName=NOTIFICATION_FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps({
                "template": "coach_invite",
                "recipientEmail": email,
                "recipientName": name,
                "variables": {},
            }).encode(),
        )
    except Exception:
        pass

    coach = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return created(coach)
