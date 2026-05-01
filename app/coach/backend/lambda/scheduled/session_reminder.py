"""
Hourly scheduled Lambda — sends reminder emails for sessions starting in 23–25 hours.
"""
import json
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3
from datetime import datetime, timezone, timedelta

from shared import db

NOTIFICATION_FUNCTION_NAME = os.environ.get("NOTIFICATION_FUNCTION_NAME", "")
_lambda_client = None


def _lambda():
    global _lambda_client
    if _lambda_client is None:
        _lambda_client = boto3.client("lambda")
    return _lambda_client


def lambda_handler(event, context):
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)

    # Query all booked sessions — use GSI3 with status prefix + date range
    sessions = db.query_gsi(
        index="GSI3",
        pk_name="GSI3PK",
        pk_value="SESSIONS",
        sk_name="GSI3SK",
        sk_between=(
            f"booked#{window_start.isoformat()[:16]}",
            f"booked#{window_end.isoformat()[:16]}",
        ),
    )

    sent = 0
    for session in sessions:
        if session.get("status") != "booked":
            continue
        if session.get("reminderSent"):
            continue

        player = db.get_item(f"PLAYER#{session.get('playerId')}", "#META")
        coach = db.get_item(f"COACH#{session.get('coachId')}", "#META")
        if not player or not coach:
            continue

        for recipient in [player, coach]:
            try:
                _lambda().invoke(
                    FunctionName=NOTIFICATION_FUNCTION_NAME,
                    InvocationType="Event",
                    Payload=json.dumps({
                        "template": "session_reminder",
                        "recipientEmail": recipient.get("email"),
                        "recipientName": recipient.get("name"),
                        "variables": {
                            "scheduledAt": session.get("scheduledAt"),
                            "venue": session.get("venue", ""),
                            "coachName": coach.get("name"),
                        },
                    }).encode(),
                )
            except Exception:
                pass

        db.update_item(f"SESSION#{session['id']}", "#META", {"reminderSent": True})
        sent += 1

    print(f"Session reminder run: sent={sent}")
    return {"sent": sent}
