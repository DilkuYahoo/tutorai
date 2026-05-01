"""
Async SES email dispatcher. Invoked with InvocationType='Event' — fire and forget.
All errors are silently swallowed to never block the calling Lambda.

Payload:
  {
    "template": "session_booked",
    "recipientEmail": "player@example.com",
    "recipientName": "John Smith",
    "variables": { ... }
  }
"""
import os
import sys
sys.path.insert(0, "/opt/python")

import boto3

SES_FROM_ADDRESS = os.environ.get("SES_FROM_ADDRESS", "noreply@playgenie.com.au")
_ses = None


def _get_ses():
    global _ses
    if _ses is None:
        _ses = boto3.client("ses", region_name="ap-southeast-2")
    return _ses


TEMPLATES = {
    "session_booked": {
        "subject": "Session Booked — Playgenie",
        "body": lambda v: f"Your session has been booked.\n\nDetails:\n{_fmt(v)}",
    },
    "session_cancelled": {
        "subject": "Session Cancelled — Playgenie",
        "body": lambda v: f"Your session has been cancelled.\n\n{'Credit forfeited (late cancellation).' if v.get('lateCancellation') else 'Credit returned to your balance.'}\n\n{_fmt(v)}",
    },
    "session_rescheduled": {
        "subject": "Session Rescheduled — Playgenie",
        "body": lambda v: f"Your session has been rescheduled.\n\nNew time: {v.get('newScheduledAt', '')}\nPrevious time: {v.get('oldScheduledAt', '')}",
    },
    "session_completed": {
        "subject": "Session Complete — Playgenie",
        "body": lambda v: f"Your session has been marked complete.\n\nCoach notes:\n{v.get('summary', 'No notes added.')}\n\nLog in to Playgenie to view the full session record.",
    },
    "session_comment": {
        "subject": "New Message from Your Coach — Playgenie",
        "body": lambda v: f"Your coach has added a comment to your session:\n\n\"{v.get('comment', '')}\"\n\nLog in to Playgenie to view and respond.",
    },
    "session_reassigned": {
        "subject": "Your Session Has Been Reassigned — Playgenie",
        "body": lambda v: f"Your session has been reassigned to {v.get('newCoachName', 'a new coach')}.\n\nPlease log in to Playgenie to confirm the details.",
    },
    "session_reminder": {
        "subject": "Session Reminder — Playgenie",
        "body": lambda v: f"Reminder: You have a session tomorrow at {v.get('scheduledAt', '')}.\n\nVenue: {v.get('venue', 'TBC')}",
    },
    "late_cancellation": {
        "subject": "Late Cancellation Alert — Playgenie",
        "body": lambda v: f"A late cancellation occurred:\n\nPlayer: {v.get('playerName', '')}\nCoach: {v.get('coachName', '')}\nSession: {v.get('scheduledAt', '')}\n\nCredit was forfeited.",
    },
    "credit_low": {
        "subject": "Low Credit Balance — Playgenie",
        "body": lambda v: f"Your credit balance is low ({v.get('creditsRemaining', 0)} credit(s) remaining).\n\nLog in to Playgenie to purchase more sessions.",
    },
    "coach_invite": {
        "subject": "Welcome to Playgenie — Your Account is Ready",
        "body": lambda v: "You have been registered as a coach on Playgenie. Check your email for your temporary password to log in for the first time.",
    },
    "video_uploaded_by_player": {
        "subject": "Player Uploaded a Training Video — Playgenie",
        "body": lambda v: f"A player has uploaded a training video for review.\n\nSession ID: {v.get('sessionId', '')}\n\nLog in to Playgenie to review and respond.",
    },
}


def _fmt(variables: dict) -> str:
    return "\n".join(f"{k}: {v}" for k, v in variables.items() if v)


def lambda_handler(event, context):
    try:
        template_key = event.get("template", "")
        recipient_email = event.get("recipientEmail", "")
        recipient_name = event.get("recipientName", "")
        variables = event.get("variables", {})

        if not recipient_email or template_key not in TEMPLATES:
            return

        template = TEMPLATES[template_key]
        subject = template["subject"]
        body_text = template["body"](variables)

        _get_ses().send_email(
            Source=SES_FROM_ADDRESS,
            Destination={"ToAddresses": [recipient_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
            },
        )
    except Exception:
        pass
