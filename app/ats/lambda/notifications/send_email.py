import json
import os
import sys
import boto3
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request

SES_FROM = os.environ.get("SES_FROM_ADDRESS", "noreply@recruit.example.com")
SES_REGION = os.environ.get("SES_REGION", "ap-southeast-2")

_ses = None


def _get_ses():
    global _ses
    if _ses is None:
        _ses = boto3.client("ses", region_name=SES_REGION)
    return _ses


TEMPLATES = {
    "application_received": {
        "subject": "We received your application — {jobTitle}",
        "body": (
            "Hi {recipientName},\n\n"
            "Thanks for applying! We've received your application and will be in touch soon.\n\n"
            "Role: {jobTitle}\n\n"
            "Recruit Team"
        ),
    },
    "interview_invite": {
        "subject": "Interview invitation — {jobTitle}",
        "body": (
            "Hi {recipientName},\n\n"
            "We'd like to invite you to interview for {jobTitle}.\n\n"
            "Type: {interviewType}\n"
            "Date & time: {scheduledAt}\n"
            "{meetingLink}"
            "Recruit Team"
        ),
    },
    "stage_change": {
        "subject": "Update on your application",
        "body": (
            "Hi {recipientName},\n\n"
            "Your application has moved to the next stage: {stage}.\n\n"
            "We'll be in touch with further details.\n\n"
            "Recruit Team"
        ),
    },
    "offer": {
        "subject": "Congratulations — you've received an offer!",
        "body": (
            "Hi {recipientName},\n\n"
            "We are delighted to extend an offer for the {jobTitle} role.\n\n"
            "Our team will be in contact shortly with the details.\n\n"
            "Recruit Team"
        ),
    },
    "rejection": {
        "subject": "Your application — {jobTitle}",
        "body": (
            "Hi {recipientName},\n\n"
            "Thank you for taking the time to apply and interview with us. "
            "After careful consideration, we have decided to move forward with another candidate at this time.\n\n"
            "We wish you all the best.\n\n"
            "Recruit Team"
        ),
    },
}


def lambda_handler(event, context):
    # This Lambda is invoked directly (not via API GW), so no CORS or preflight needed.
    try:
        if isinstance(event.get("body"), str):
            payload = json.loads(event["body"])
        else:
            payload = event  # Direct invocation
    except (json.JSONDecodeError, TypeError):
        return bad_request("Invalid payload")

    template_key    = payload.get("template")
    recipient_email = payload.get("recipientEmail")
    recipient_name  = payload.get("recipientName", "")
    variables       = payload.get("variables", {})

    if not template_key or not recipient_email:
        return bad_request("template and recipientEmail are required")

    template = TEMPLATES.get(template_key)
    if not template:
        return bad_request(f"Unknown template: {template_key}")

    fmt_vars = {"recipientName": recipient_name, **variables}
    meeting_link = variables.get("meetingLink", "")
    fmt_vars["meetingLink"] = f"Meeting link: {meeting_link}\n\n" if meeting_link else "\n"

    try:
        subject = template["subject"].format(**fmt_vars)
        body    = template["body"].format(**fmt_vars)
    except KeyError as e:
        return bad_request(f"Missing template variable: {e}")

    _get_ses().send_email(
        Source=SES_FROM,
        Destination={"ToAddresses": [recipient_email]},
        Message={
            "Subject": {"Data": subject, "Charset": "UTF-8"},
            "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
        },
    )

    return ok({"sent": True, "to": recipient_email, "template": template_key})
