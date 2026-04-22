import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, preflight
from shared.auth import require_role
from shared import db
from shared.validation import INTERVIEW_STATUSES


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin", "hiring_manager")
    if denied:
        return denied

    params = event.get("queryStringParameters") or {}
    status_filter = params.get("status")
    application_id = params.get("applicationId")

    if application_id:
        items = db.query_gsi(
            index="GSI1",
            pk_name="GSI1PK",
            pk_value=f"APPLICATION#{application_id}",
            sk_name="GSI1SK",
            sk_prefix="INTERVIEW#",
        )
    elif status_filter:
        items = db.query_gsi(
            index="GSI2",
            pk_name="GSI2PK",
            pk_value="INTERVIEWS",
            sk_name="GSI2SK",
            sk_prefix=f"{status_filter}#",
        )
    else:
        # Return all scheduled first, then completed
        scheduled = db.query_gsi(
            index="GSI2",
            pk_name="GSI2PK",
            pk_value="INTERVIEWS",
            sk_name="GSI2SK",
            sk_prefix="Scheduled#",
        )
        completed = db.query_gsi(
            index="GSI2",
            pk_name="GSI2PK",
            pk_value="INTERVIEWS",
            sk_name="GSI2SK",
            sk_prefix="Completed#",
            scan_forward=False,
        )
        items = scheduled + completed

    interviews = [{k: v for k, v in i.items() if not k.startswith(("PK", "SK", "GSI"))} for i in items]
    return ok(interviews)
