import json
import os
import random
import string
import sys
sys.path.insert(0, "/opt/python")

import boto3
from botocore.exceptions import ClientError

from shared.response import created, bad_request, conflict, preflight
from shared.ids import generate_id, utc_now
from shared.validation import require_fields, ValidationError
from shared import db

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


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
                {"Name": "custom:role", "Value": "player"},
            ],
            MessageAction="SUPPRESS",  # Player sets their own password
        )
    except ClientError as e:
        if e.response["Error"]["Code"] == "UsernameExistsException":
            return conflict(f"An account with email '{email}' already exists")
        raise

    attrs = {a["Name"]: a["Value"] for a in resp["User"].get("Attributes", [])}
    player_id = attrs.get("sub", resp["User"]["Username"])

    item = {
        "PK": f"PLAYER#{player_id}",
        "SK": "#META",
        "GSI1PK": "PLAYERS",
        "GSI1SK": name.lower(),
        "id": player_id,
        "name": name,
        "email": email,
        "role": "player",
        "parentId": None,
        "balanceAvailable": 0,
        "balanceCommitted": 0,
        "totalPurchased": 0,
        "createdAt": utc_now(),
    }
    db.put_item(item)

    player = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return created(player)
