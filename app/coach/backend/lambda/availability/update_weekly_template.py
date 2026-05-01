import json
import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, is_coach_or_super
from shared.response import ok, bad_request, forbidden, preflight
from shared.ids import utc_now
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Only coaches can update availability")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return bad_request("Invalid JSON")

    # windows: {"monday": [{"start": "15:00", "end": "19:00"}], ...}
    windows = body.get("windows")
    if windows is None:
        return bad_request("'windows' is required")

    coach_id = get_user_id(event)
    db.put_item({
        "PK": f"COACH#{coach_id}",
        "SK": "AVAIL#TEMPLATE",
        "coachId": coach_id,
        "windows": windows,
        "updatedAt": utc_now(),
    })

    return ok({"coachId": coach_id, "windows": windows})
