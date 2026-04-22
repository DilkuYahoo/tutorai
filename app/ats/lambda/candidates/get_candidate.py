import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, not_found, preflight
from shared.auth import require_role
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    candidate_id = event.get("pathParameters", {}).get("candidateId")
    item = db.get_item(f"CANDIDATE#{candidate_id}", "#META")
    if not item:
        return not_found(f"Candidate {candidate_id} not found")

    candidate = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(candidate)
