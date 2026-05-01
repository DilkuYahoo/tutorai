import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import require_role, get_user_id
from shared.response import ok, bad_request, not_found, forbidden, preflight
from shared.ids import utc_now
from shared import db

USER_POOL_ID = os.environ.get("USER_POOL_ID", "")


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    coach_id = (event.get("pathParameters") or {}).get("coachId", "")

    # Super coach cannot deregister themselves
    caller_id = get_user_id(event)
    if coach_id == caller_id:
        return forbidden("Super coach cannot deregister themselves")

    coach = db.get_item(f"COACH#{coach_id}", "#META")
    if not coach:
        return not_found("Coach not found")

    # Block deactivation if upcoming sessions exist
    upcoming = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value=f"COACH#{coach_id}",
        sk_name="GSI1SK",
        sk_prefix="SESSION#",
    )
    booked = [s for s in upcoming if s.get("status") == "booked"]
    if booked:
        return bad_request(
            f"Coach has {len(booked)} upcoming sessions. Resolve all sessions before deregistering."
        )

    # Disable in Cognito
    cognito = boto3.client("cognito-idp")
    cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=coach["email"])

    # Mark inactive in DynamoDB (retain all history)
    db.update_item(f"COACH#{coach_id}", "#META", {
        "status": "inactive",
        "GSI1SK": f"inactive#{coach.get('name', '').lower()}",
        "deregisteredAt": utc_now(),
    })

    return ok({"message": "Coach deregistered successfully"})
