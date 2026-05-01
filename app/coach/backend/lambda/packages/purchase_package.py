import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.auth import get_user_id, get_role
from shared.response import created, bad_request, not_found, forbidden, preflight
from shared.ids import generate_id, utc_now
from shared import db

STRIPE_SECRET_ARN = os.environ.get("STRIPE_SECRET_ARN", "")
_stripe_secret = None
_secrets_client = None


def _get_stripe_key():
    global _stripe_secret, _secrets_client
    if _stripe_secret is None:
        if _secrets_client is None:
            _secrets_client = boto3.client("secretsmanager")
        resp = _secrets_client.get_secret_value(SecretId=STRIPE_SECRET_ARN)
        _stripe_secret = resp["SecretString"]
    return _stripe_secret


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    role = get_role(event)
    if role not in ("player", "parent"):
        return forbidden("Only players and parents can purchase packages")

    pkg_id = (event.get("pathParameters") or {}).get("packageId", "")
    pkg = db.get_item(f"PACKAGE#{pkg_id}", "#META")
    if not pkg:
        return not_found("Package not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    # Determine which player this is for
    user_id = get_user_id(event)
    if role == "parent":
        player_id = body.get("playerId")
        if not player_id:
            return bad_request("'playerId' is required for parent purchases")
        # Verify child belongs to parent
        link = db.get_item(f"PARENT#{user_id}", f"CHILD#{player_id}")
        if not link:
            return forbidden("That player is not your child")
    else:
        player_id = user_id

    player = db.get_item(f"PLAYER#{player_id}", "#META")
    if not player:
        return not_found("Player not found")

    coach_id = body.get("coachId")

    import stripe
    stripe.api_key = _get_stripe_key()

    cors_origin = os.environ.get("CORS_ORIGIN", "https://playgenie.com.au")
    purchase_id = generate_id()

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "aud",
                "unit_amount": int(float(pkg["price"]) * 100),  # cents
                "product_data": {
                    "name": f"Playgenie — {pkg['name']}",
                    "description": pkg.get("description", ""),
                },
            },
            "quantity": 1,
        }],
        success_url=f"{cors_origin}/booking?purchase=success&purchaseId={purchase_id}",
        cancel_url=f"{cors_origin}/coaches/{coach_id or ''}?purchase=cancelled",
        metadata={
            "purchaseId": purchase_id,
            "playerId": player_id,
            "packageId": pkg_id,
            "coachId": coach_id or "",
            "sessionCount": str(pkg["sessionCount"]),
        },
    )

    # Record pending purchase
    db.put_item({
        "PK": f"PLAYER#{player_id}",
        "SK": f"PKGPURCHASE#{purchase_id}",
        "GSI1PK": f"COACH#{coach_id}" if coach_id else "COACH#none",
        "GSI1SK": f"PKGPURCHASE#{purchase_id}",
        "id": purchase_id,
        "playerId": player_id,
        "packageId": pkg_id,
        "packageName": pkg.get("name"),
        "sessionCount": int(pkg["sessionCount"]),
        "price": float(pkg["price"]),
        "coachId": coach_id,
        "stripeSessionId": session.id,
        "status": "pending",
        "createdAt": utc_now(),
    })

    return created({"checkoutUrl": session.url, "purchaseId": purchase_id})
