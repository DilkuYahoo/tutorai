import json
import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, not_found, preflight
from shared.auth import require_role
from shared import db

ALLOWED_FIELDS = {"tags", "notes", "linkedinUrl", "phone", "location", "resumeUrl", "communicationScore"}


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    candidate_id = event.get("pathParameters", {}).get("candidateId")
    existing = db.get_item(f"CANDIDATE#{candidate_id}", "#META")
    if not existing:
        return not_found(f"Candidate {candidate_id} not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    updates = {k: v for k, v in body.items() if k in ALLOWED_FIELDS}
    if not updates:
        return bad_request("No valid fields to update")

    updated = db.update_item(f"CANDIDATE#{candidate_id}", "#META", updates)
    candidate = {k: v for k, v in updated.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(candidate)
