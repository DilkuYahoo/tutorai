import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, not_found, preflight
from shared import db
from shared.slots import resolve_available_slots


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    coach_id = (event.get("pathParameters") or {}).get("coachId", "")
    coach = db.get_item(f"COACH#{coach_id}", "#META")
    if not coach or coach.get("status") != "active":
        return not_found("Coach not found")

    params = event.get("queryStringParameters") or {}
    date_from = params.get("from")
    date_to = params.get("to")
    if not date_from or not date_to:
        return bad_request("Query params 'from' and 'to' (YYYY-MM-DD) are required")

    slots = resolve_available_slots(coach_id, date_from, date_to)
    return ok({"coachId": coach_id, "slots": slots})
