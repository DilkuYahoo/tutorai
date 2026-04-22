import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import created, bad_request, conflict, preflight
from shared.ids import generate_id, utc_now, today
from shared.validation import ValidationError, require_fields
from shared import db

REQUIRED = ["firstName", "lastName", "email"]


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    try:
        require_fields(body, REQUIRED)
    except ValidationError as e:
        return bad_request(str(e))

    # Idempotency: check for existing candidate with same email
    existing = db.query_gsi(
        index="GSI2",
        pk_name="GSI2PK",
        pk_value=f"EMAIL#{body['email'].lower()}",
        limit=1,
    )
    if existing:
        return conflict(f"A candidate with email {body['email']} already exists")

    candidate_id = generate_id()
    now = today()

    item = {
        "PK": f"CANDIDATE#{candidate_id}",
        "SK": "#META",
        "GSI1PK": "CANDIDATES",
        "GSI1SK": f"{now}#{candidate_id}",
        "GSI2PK": f"EMAIL#{body['email'].lower()}",
        "GSI2SK": f"CANDIDATE#{candidate_id}",
        "id": candidate_id,
        "firstName": body["firstName"],
        "lastName": body["lastName"],
        "email": body["email"].lower(),
        "phone": body.get("phone", ""),
        "location": body.get("location", ""),
        "linkedinUrl": body.get("linkedinUrl", ""),
        "resumeUrl": body.get("resumeUrl", ""),
        "coverLetterText": body.get("coverLetterText", ""),
        "source": body.get("source", "Direct"),
        "tags": body.get("tags", []),
        "notes": body.get("notes", ""),
        "createdAt": now,
    }

    db.put_item(item)
    return created({"id": candidate_id})
