import json
import os
import uuid
import urllib.request
import boto3
from datetime import datetime, timezone

S3_BUCKET          = os.environ.get("S3_BUCKET", "ratescan.com.au")
SEND_EMAIL_API_URL = os.environ.get("SEND_EMAIL_API_URL", "")
RECIPIENT          = "info@ratescan.com.au"
SENDER             = "noreply@ratescan.com.au"

s3 = boto3.client("s3")

REQUIRED_FIELDS = ["name", "age", "mobile", "email", "propertyValue", "loanAmount", "propertyPurpose", "loanPurpose", "employmentType", "income", "expenses"]

_LABEL = {
    "propertyPurpose":  "Property Purpose",
    "loanPurpose":      "Loan Purpose",
    "rateType":         "Rate Type",
    "repaymentType":    "Repayment Type",
    "propertyValue":    "Property Value",
    "loanAmount":       "Loan Amount",
    "employmentType":   "Employment Type",
    "income":           "Annual Income",
    "expenses":         "Monthly Expenses",
    "dependants":       "Dependants",
    "otherInfo":        "Other Info",
}

_CURRENCY_FIELDS = {"propertyValue", "loanAmount", "income", "expenses"}


def _fmt(key, value):
    if value is None or value == "":
        return None
    if key in _CURRENCY_FIELDS:
        try:
            return f"${int(float(str(value).replace(',', ''))):,}"
        except (ValueError, TypeError):
            pass
    return str(value).replace("-", " ").title()


def _build_email_body(body, application_id):
    pv = float(str(body.get("propertyValue", "0")).replace(",", "") or 0)
    la = float(str(body.get("loanAmount", "0")).replace(",", "") or 0)
    lvr = f"{(la / pv * 100):.1f}%" if pv > 0 and la > 0 else "—"

    lines = [
        f"New mortgage application received — ID: {application_id}",
        "",
        "── Applicant ──────────────────────────────",
        f"  Name:    {body.get('name', '')}",
        f"  Age:     {body.get('age', '')}",
        f"  Mobile:  {body.get('mobile', '')}",
        f"  Email:   {body.get('email', '')}",
        "",
        "── Property ───────────────────────────────",
        f"  Purpose:        {_fmt('propertyPurpose', body.get('propertyPurpose'))}",
        f"  Loan Purpose:   {_fmt('loanPurpose', body.get('loanPurpose'))}",
        f"  Rate Type:      {_fmt('rateType', body.get('rateType'))}",
        f"  Repayment Type: {_fmt('repaymentType', body.get('repaymentType'))}",
        f"  Property Value: {_fmt('propertyValue', body.get('propertyValue'))}",
        f"  Loan Amount:    {_fmt('loanAmount', body.get('loanAmount'))}",
        f"  LVR:            {lvr}",
        "",
        "── Finances ───────────────────────────────",
        f"  Employment:       {_fmt('employmentType', body.get('employmentType'))}",
        f"  Annual Income:    {_fmt('income', body.get('income'))}",
        f"  Monthly Expenses: {_fmt('expenses', body.get('expenses'))}",
        f"  Dependants:       {body.get('dependants', 0)}",
    ]

    if body.get("otherInfo"):
        lines += ["", "── Additional Info ────────────────────────", f"  {body['otherInfo']}"]

    return "\n".join(lines)


def _send_notification(body, application_id):
    if not SEND_EMAIL_API_URL:
        print("WARNING: SEND_EMAIL_API_URL not set — skipping email notification")
        return

    applicant_name = body.get("name", "Unknown")
    payload = {
        "sender":    SENDER,
        "recipient": RECIPIENT,
        "subject":   f"New Application — {applicant_name} (ID: {application_id[:8]})",
        "body":      _build_email_body(body, application_id),
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
            print(f"INFO: notification email sent, upstream status {resp.status}")
    except Exception as exc:
        print(f"WARNING: notification email failed (non-fatal): {exc}")


def lambda_handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return _cors(204, "")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _cors(400, json.dumps({"error": "Invalid JSON"}))

    missing = [f for f in REQUIRED_FIELDS if not body.get(f)]
    if missing:
        return _cors(400, json.dumps({"error": f"Missing fields: {', '.join(missing)}"}))

    application_id = str(uuid.uuid4())
    payload = {
        **body,
        "id": application_id,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=f"applications/{application_id}.json",
        Body=json.dumps(payload),
        ContentType="application/json",
    )

    _send_notification(body, application_id)

    return _cors(201, json.dumps({"id": application_id}))


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
