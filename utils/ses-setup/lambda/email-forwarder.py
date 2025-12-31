import os
import time
import logging
from typing import Dict, Any, Optional, List

import boto3
from botocore.exceptions import ClientError
from email import message_from_bytes
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

# =========================
# Configuration
# =========================

FORWARD_PREFIX = os.environ["FORWARD_PREFIX"]
REGION = os.environ.get("Region", os.environ.get("AWS_REGION", "us-east-1"))

MAIL_S3_BUCKET = os.environ["MAIL_S3_BUCKET"]
MAIL_S3_PREFIX = os.environ["MAIL_S3_PREFIX"]

MAIL_SENDER = os.environ["MAIL_SENDER"]  # verified identity in SES outbound
DEFAULT_FORWARD_TO = os.environ["DEFAULT_FORWARD_TO"]

# DynamoDB routing table
ROUTE_TABLE_NAME = os.environ["ROUTE_TABLE_NAME"]  # e.g. ses_inbound_routes
ROUTE_PK_NAME = os.environ["ROUTE_PK_NAME"]  # partition key attribute name
ROUTE_TARGET_ATTR = os.environ["ROUTE_TARGET_ATTR"]  # attribute holding target email(s)
ROUTE_ENABLED_ATTR = os.environ["ROUTE_ENABLED_ATTR"]  # optional; boolean
ROUTE_MAIL_SENDER_ATTR = os.environ["ROUTE_MAIL_SENDER_ATTR"]  # attribute holding mail sender
ROUTE_CACHE_TTL_SECONDS = int(os.environ["ROUTE_CACHE_TTL_SECONDS"])

# =========================
# Logging
# =========================

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# =========================
# AWS clients/resources
# =========================

s3_client = boto3.client("s3", region_name=REGION)
ses_client = boto3.client("ses", region_name=REGION)
dynamodb = boto3.resource("dynamodb", region_name=REGION)
route_table = dynamodb.Table(ROUTE_TABLE_NAME)

# Simple in-memory cache (survives warm Lambda invocations)
_route_cache: Dict[str, Dict[str, Any]] = {}  # domain -> {"expires": epoch, "forward_to": "a@x.com,b@y.com"}


# =========================
# Helpers
# =========================

def _normalize_domain(email_addr: str) -> str:
    email_addr = (email_addr or "").strip()
    if "@" not in email_addr:
        return ""
    return email_addr.split("@", 1)[1].lower().strip()


def _normalize_addresses(value: str) -> List[str]:
    """
    Accepts a single email or a comma/semicolon-separated list.
    Returns a clean list of email addresses.
    """
    if not value:
        return []
    raw = value.replace(";", ",")
    return [x.strip() for x in raw.split(",") if x.strip()]


def _get_first_recipient(event: Dict[str, Any]) -> str:
    """
    SES inbound puts envelope recipients into:
      event['Records'][0]['ses']['mail']['destination'] (list[str])
    """
    try:
        recs = event.get("Records", [])
        if recs and "ses" in recs[0]:
            dests = recs[0]["ses"]["mail"].get("destination", []) or []
            if dests:
                return dests[0]
    except Exception:
        pass
    return ""


def _get_message_id(event: Dict[str, Any]) -> str:
    if "Records" in event and event["Records"]:
        return event["Records"][0]["ses"]["mail"]["messageId"]
    if "messageId" in event:
        return event["messageId"]
    raise ValueError("Unable to extract messageId from event")


def get_message_from_s3(message_id: str) -> Dict[str, Any]:
    """
    Retrieve the email message from S3.
    """
    object_path = f"{MAIL_S3_PREFIX}/{message_id}" if MAIL_S3_PREFIX else message_id
    object_http_path = (
        f"http://s3.console.aws.amazon.com/s3/object/{MAIL_S3_BUCKET}/{object_path}?region={REGION}"
    )
    try:
        obj = s3_client.get_object(Bucket=MAIL_S3_BUCKET, Key=object_path)
        file_content = obj["Body"].read()
        return {"file": file_content, "path": object_http_path}
    except ClientError as e:
        logger.error("Error retrieving message from S3: %s", e)
        raise


def extract_body_content(mailobject) -> str:
    """
    Extract HTML if available, otherwise fallback to plain text.
    """
    html = None
    text = None
    for part in mailobject.walk():
        ctype = part.get_content_type()
        if ctype in ("text/html", "text/plain"):
            payload = part.get_payload(decode=True)
            if isinstance(payload, bytes):
                decoded = payload.decode("utf-8", errors="ignore")
            else:
                decoded = payload if isinstance(payload, str) else ""
            if ctype == "text/html" and not html:
                html = decoded
            if ctype == "text/plain" and not text:
                text = decoded

    if html:
        return html
    if text:
        # minimal HTML wrapper so forwarding still renders nicely
        escaped = (text
                   .replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;"))
        return f"<pre>{escaped}</pre>"
    return ""


def lookup_forward_targets(domain: str) -> Dict[str, Any]:
    """
    Look up the forwarding target(s) and mail sender for a given domain in DynamoDB.

    Table shape (recommended):
      PK: domain (string)
      forward_to: "dest1@example.com,dest2@example.com"
      mail_sender: "sender@example.com"
      enabled: true/false  (optional)

    Returns a dict with 'forward_to' (list of emails) and 'mail_sender' (string).
    Falls back to DEFAULT_FORWARD_TO and MAIL_SENDER if no match.
    """
    domain = (domain or "").lower().strip()
    now = int(time.time())

    # 1) cache
    cached = _route_cache.get(domain)
    if cached and cached.get("expires", 0) > now:
        return {
            "forward_to": _normalize_addresses(cached.get("forward_to", "")),
            "mail_sender": cached.get("mail_sender", MAIL_SENDER)
        }

    # 2) DDB
    forward_to = ""
    mail_sender = ""
    try:
        logger.info("Querying DynamoDB for domain='%s' with key %s='%s'", domain, ROUTE_PK_NAME, domain)
        resp = route_table.get_item(Key={ROUTE_PK_NAME: domain})
        item = resp.get("Item") or {}
        logger.info("DynamoDB response for domain='%s': item=%s", domain, item)
        enabled = item.get(ROUTE_ENABLED_ATTR, True)
        if enabled:
            forward_to = (item.get(ROUTE_TARGET_ATTR) or "").strip()
            mail_sender = (item.get(ROUTE_MAIL_SENDER_ATTR) or "").strip()
            logger.info("Extracted for domain='%s': forward_to='%s', mail_sender='%s'", domain, forward_to, mail_sender)
        else:
            logger.info("Domain '%s' is disabled", domain)
    except ClientError as e:
        # If DDB has a transient issue, don't drop mail; use default.
        logger.error("DynamoDB get_item failed for domain=%s: %s", domain, e)

    if not forward_to:
        forward_to = DEFAULT_FORWARD_TO
        logger.info("No forward_to found for domain='%s', using DEFAULT_FORWARD_TO='%s'", domain, forward_to)
    if not mail_sender:
        mail_sender = MAIL_SENDER
        logger.info("No mail_sender found for domain='%s', using MAIL_SENDER='%s'", domain, mail_sender)

    # refresh cache (even if empty so we don't hammer DDB)
    _route_cache[domain] = {
        "expires": now + ROUTE_CACHE_TTL_SECONDS,
        "forward_to": forward_to,
        "mail_sender": mail_sender
    }
    return {
        "forward_to": _normalize_addresses(forward_to),
        "mail_sender": mail_sender
    }


def create_forward_message(file_dict: Dict[str, Any], forward_to: List[str], original_recipient: str, mail_sender: str = None) -> Dict[str, Any]:
    """
    Build a new message body and forward it.
    """
    if mail_sender is None:
        mail_sender = MAIL_SENDER

    mailobject = message_from_bytes(file_dict["file"])

    subject_original = mailobject.get("Subject", "")
    subject = f"{FORWARD_PREFIX} {subject_original}".strip()

    body_content = extract_body_content(mailobject)

    # optional: keep original sender for reply context
    original_from = mailobject.get("From", "")

    msg = MIMEMultipart()
    msg.attach(MIMEText(body_content, "html"))

    msg["Subject"] = subject
    msg["From"] = mail_sender
    msg["To"] = ", ".join(forward_to)
    logger.info("Creating forward message with sender='%s', recipients=%s", mail_sender, forward_to)

    # helpful headers
    msg["Auto-Submitted"] = "auto-forwarded"
    msg["X-Forwarded-By"] = "CognifyLabs SES Forwarder"
    msg["X-Original-To"] = "info@cognifylabs.com.au"
    if original_from:
        msg["X-Original-From"] = original_from
        msg["Reply-To"] = original_from
    if original_recipient:
        msg["X-Original-Recipient"] = original_recipient

    return {
        "Source": mail_sender,
        "Destinations": forward_to,
        "Data": msg.as_string(),
    }


def send_email(message: Dict[str, Any]) -> str:
    """
    Send the email via SES.
    """
    try:
        resp = ses_client.send_raw_email(
            Source=message["Source"],
            Destinations=message["Destinations"],
            RawMessage={"Data": message["Data"]},
        )
        return f"Email sent! Message ID: {resp['MessageId']}"
    except ClientError as e:
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        logger.error("Error sending email: %s", error_msg)
        return f"Failed to send email: {error_msg}"


# =========================
# Lambda entrypoint
# =========================

def lambda_handler(event: Dict[str, Any], context: Any) -> None:
    """
    SES inbound -> S3 -> Lambda -> forward based on recipient domain via DynamoDB.
    """
    message_id = _get_message_id(event)
    original_recipient = _get_first_recipient(event)
    domain = _normalize_domain(original_recipient)

    logger.info("Inbound message_id=%s original_recipient=%s domain=%s", message_id, original_recipient, domain)

    route_info = lookup_forward_targets(domain)
    forward_to = route_info["forward_to"]
    mail_sender = route_info["mail_sender"]
    logger.info("Route lookup for domain '%s': forward_to=%s, mail_sender=%s", domain, forward_to, mail_sender)
    if not forward_to:
        raise ValueError(
            f"No forwarding target found for domain '{domain}' and no DEFAULT_FORWARD_TO configured."
        )

    file_dict = get_message_from_s3(message_id)
    message = create_forward_message(file_dict, forward_to=forward_to, original_recipient=original_recipient, mail_sender=mail_sender)
    result = send_email(message)
    logger.info(result)
