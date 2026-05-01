import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

from shared.response import ok, bad_request, server_error
from shared.ids import generate_id, utc_now
from shared import db

STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_SECRET_ARN = os.environ.get("STRIPE_SECRET_ARN", "")
NOTIFICATION_FUNCTION_NAME = os.environ.get("NOTIFICATION_FUNCTION_NAME", "")

_stripe_secret = None
_secrets_client = None
_lambda_client = None


def _get_stripe_key():
    global _stripe_secret, _secrets_client
    if _stripe_secret is None:
        if _secrets_client is None:
            _secrets_client = boto3.client("secretsmanager")
        resp = _secrets_client.get_secret_value(SecretId=STRIPE_SECRET_ARN)
        _stripe_secret = resp["SecretString"]
    return _stripe_secret


def _lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client("lambda")
    return _lambda_client


def _notify(payload):
    try:
        _lambda().invoke(
            FunctionName=NOTIFICATION_FUNCTION_NAME,
            InvocationType="Event",
            Payload=json.dumps(payload).encode(),
        )
    except Exception:
        pass


def lambda_handler(event, context):
    import stripe
    stripe.api_key = _get_stripe_key()

    body = event.get("body", "")
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    sig = headers.get("stripe-signature", "")

    try:
        webhook_event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        return bad_request("Invalid Stripe signature")
    except Exception as e:
        return bad_request(f"Webhook error: {str(e)}")

    event_type = webhook_event["type"]
    data = webhook_event["data"]["object"]

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(data)
    elif event_type == "invoice.paid":
        _handle_invoice_paid(data)
    elif event_type == "invoice.payment_failed":
        _handle_invoice_failed(data)

    return ok({"received": True})


def _handle_checkout_completed(session):
    metadata = session.get("metadata", {})
    purchase_id = metadata.get("purchaseId")
    player_id = metadata.get("playerId")
    pkg_id = metadata.get("packageId")
    session_count = int(metadata.get("sessionCount", 0))

    if not all([purchase_id, player_id, pkg_id]):
        return

    player = db.get_item(f"PLAYER#{player_id}", "#META")
    if not player:
        return

    avail = int(player.get("balanceAvailable", 0))
    total = int(player.get("totalPurchased", 0))
    now = utc_now()
    new_avail = avail + session_count
    new_total = total + session_count

    ledger_entry = {
        "PK": f"CREDITS#{player_id}",
        "SK": f"{now}#{generate_id()}",
        "GSI3PK": "CREDITS",
        "GSI3SK": f"{player_id}#{now}",
        "type": "purchase",
        "delta": session_count,
        "fromState": "purchased",
        "toState": "available",
        "balanceAvailable": new_avail,
        "balanceCommitted": int(player.get("balanceCommitted", 0)),
        "packageId": pkg_id,
        "purchaseId": purchase_id,
        "stripeSessionId": session.get("id"),
        "coachId": metadata.get("coachId", ""),
        "createdAt": now,
    }

    db.transact_write([
        {"Put": {"Item": ledger_entry}},
        {"Update": {
            "Key": {"PK": f"PLAYER#{player_id}", "SK": "#META"},
            "UpdateExpression": "SET balanceAvailable = :a, totalPurchased = :t",
            "ExpressionAttributeValues": {":a": new_avail, ":t": new_total},
        }},
        {"Update": {
            "Key": {"PK": f"PLAYER#{player_id}", "SK": f"PKGPURCHASE#{purchase_id}"},
            "UpdateExpression": "SET #s = :s, paidAt = :t, stripePaymentIntentId = :pi",
            "ExpressionAttributeNames": {"#s": "status"},
            "ExpressionAttributeValues": {
                ":s": "paid",
                ":t": now,
                ":pi": session.get("payment_intent", ""),
            },
        }},
    ])

    _notify({
        "template": "session_booked",  # credit_purchased template — reuse or add
        "recipientEmail": player.get("email"),
        "recipientName": player.get("name"),
        "variables": {"creditsAdded": session_count, "newBalance": new_avail},
    })


def _handle_invoice_paid(invoice):
    stripe_invoice_id = invoice.get("id")
    if not stripe_invoice_id:
        return

    # Find the invoice in DynamoDB by stripeInvoiceId (would need a GSI or scan — simplified here)
    # In production: add GSI on stripeInvoiceId, or store DDB invoice ID in Stripe metadata
    from boto3.dynamodb.conditions import Attr
    items = db.table().scan(
        FilterExpression=Attr("PK").begins_with("INVOICE#") & Attr("stripeInvoiceId").eq(stripe_invoice_id)
    ).get("Items", [])

    now = utc_now()
    for item in items:
        db.update_item(item["PK"], item["SK"], {"status": "paid", "paidAt": now})


def _handle_invoice_failed(invoice):
    stripe_invoice_id = invoice.get("id")
    if not stripe_invoice_id:
        return
    from boto3.dynamodb.conditions import Attr
    items = db.table().scan(
        FilterExpression=Attr("PK").begins_with("INVOICE#") & Attr("stripeInvoiceId").eq(stripe_invoice_id)
    ).get("Items", [])
    now = utc_now()
    for item in items:
        db.update_item(item["PK"], item["SK"], {"status": "failed", "failedAt": now})
