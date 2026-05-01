import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3
from botocore.exceptions import ClientError

from shared.response import created, bad_request, conflict, preflight
from shared.ids import utc_now
from shared.validation import require_fields, ValidationError
from shared import db

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, ["name", "email", "password"])
    except ValidationError as e:
        return bad_request(str(e))

    name = body["name"].strip()
    email = body["email"].strip().lower()

    cognito = boto3.client("cognito-idp")
    try:
        resp = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            TemporaryPassword=body["password"],
            UserAttributes=[
                {"Name": "name", "Value": name},
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "custom:role", "Value": "parent"},
            ],
            MessageAction="SUPPRESS",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "UsernameExistsException":
            return conflict(f"An account with email '{email}' already exists")
        raise

    attrs = {a["Name"]: a["Value"] for a in resp["User"].get("Attributes", [])}
    parent_id = attrs.get("sub", resp["User"]["Username"])

    item = {
        "PK": f"PARENT#{parent_id}",
        "SK": "#META",
        "GSI1PK": "PARENTS",
        "GSI1SK": name.lower(),
        "id": parent_id,
        "name": name,
        "email": email,
        "role": "parent",
        "createdAt": utc_now(),
    }
    db.put_item(item)

    parent = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return created(parent)
