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

    app_id = event.get("pathParameters", {}).get("applicationId")
    item = db.get_item(f"APPLICATION#{app_id}", "#META")
    if not item:
        return not_found(f"Application {app_id} not found")

    # Fetch all stage history entries for this application
    history_items = db.query_pk(f"APPLICATION#{app_id}", sk_prefix="HISTORY#")
    history = [
        {
            "stage": h.get("stage"),
            "movedAt": h.get("movedAt"),
            "movedBy": h.get("movedBy"),
            "note": h.get("note", ""),
        }
        for h in history_items
    ]

    application = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    application["stageHistory"] = history

    return ok(application)
