import json
import os
import re
import urllib.request
import urllib.error

SEND_EMAIL_API_URL = os.environ.get("SEND_EMAIL_API_URL", "")
RECIPIENT          = "info@ratescan.com.au"
SENDER             = "noreply@ratescan.com.au"
MAX_MESSAGE_LEN    = 2000
EMAIL_RE           = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _cors(204, "")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors(400, json.dumps({"error": "Invalid JSON"}))

    # Honeypot — bots fill hidden fields; silently accept so they think it worked
    if body.get("website"):
        return _cors(200, json.dumps({"message": "Email sent successfully"}))

    name    = (body.get("name")    or "").strip()
    email   = (body.get("email")   or "").strip()
    message = (body.get("message") or "").strip()

    if not name or not email or not message:
        return _cors(400, json.dumps({"error": "name, email and message are required"}))

    if not EMAIL_RE.match(email):
        return _cors(400, json.dumps({"error": "Invalid email address"}))

    if len(message) > MAX_MESSAGE_LEN:
        return _cors(400, json.dumps({"error": f"Message must be {MAX_MESSAGE_LEN} characters or fewer"}))

    payload = {
        "sender":    SENDER,
        "recipient": RECIPIENT,
        "subject":   f"RateScan Contact — {name}",
        "body":      f"Name: {name}\nEmail: {email}\n\nMessage:\n{message}",
        "is_html":   False,
    }

    try:
        req = urllib.request.Request(
            SEND_EMAIL_API_URL,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status >= 300:
                raise ValueError(f"upstream status {resp.status}")
    except Exception as exc:
        return _cors(502, json.dumps({"error": f"Failed to send email: {exc}"}))

    return _cors(200, json.dumps({"message": "Email sent successfully"}))


def _cors(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": body,
    }
