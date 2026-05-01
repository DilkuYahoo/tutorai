import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, not_found, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    coach_id = (event.get("pathParameters") or {}).get("coachId", "")
    coach = db.get_item(f"COACH#{coach_id}", "#META")
    if not coach or coach.get("status") != "active":
        return not_found("Coach not found")

    pkg_items = db.query_pk(f"COACH#{coach_id}", sk_prefix="PACKAGE#")
    active_packages = []
    for p in pkg_items:
        if not p.get("active"):
            continue
        # Hydrate template details
        template = db.get_item(f"PACKAGE#{p.get('packageId')}", "#META")
        if template:
            active_packages.append({k: v for k, v in template.items()
                                    if not k.startswith(("PK", "SK", "GSI"))})

    out = {k: v for k, v in coach.items() if not k.startswith(("PK", "SK", "GSI"))}
    out["activePackages"] = active_packages
    return ok(out)
