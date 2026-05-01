import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import require_role
from shared.response import ok, bad_request, not_found, preflight
from shared.ids import utc_now
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "super_coach")
    if denied:
        return denied

    coach_id = (event.get("pathParameters") or {}).get("coachId", "")
    coach = db.get_item(f"COACH#{coach_id}", "#META")
    if not coach:
        return not_found("Coach not found")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    # assignments: [{"packageId": "...", "active": true}, ...]
    assignments = body.get("assignments")
    if not isinstance(assignments, list):
        return bad_request("'assignments' must be a list")

    now = utc_now()
    for a in assignments:
        pkg_id = a.get("packageId")
        active = bool(a.get("active", True))
        if not pkg_id:
            continue
        pkg = db.get_item(f"PACKAGE#{pkg_id}", "#META")
        if not pkg:
            continue
        db.put_item({
            "PK": f"COACH#{coach_id}",
            "SK": f"PACKAGE#{pkg_id}",
            "coachId": coach_id,
            "packageId": pkg_id,
            "packageName": pkg.get("name"),
            "tier": pkg.get("tier"),
            "sessionCount": pkg.get("sessionCount"),
            "price": pkg.get("price"),
            "active": active,
            "assignedAt": now,
        })

    return ok({"message": f"Package assignments updated for coach {coach_id}"})
