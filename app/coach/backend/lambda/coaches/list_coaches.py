import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    coaches = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value="COACHES",
        sk_name="GSI1SK",
        sk_prefix="active#",
    )

    out = []
    for c in coaches:
        coach = {k: v for k, v in c.items() if not k.startswith(("PK", "SK", "GSI"))}
        # Load active packages
        pkg_items = db.query_pk(f"COACH#{coach['id']}", sk_prefix="PACKAGE#")
        coach["activePackages"] = [
            {k: v for k, v in p.items() if not k.startswith(("PK", "SK", "GSI"))}
            for p in pkg_items if p.get("active")
        ]
        out.append(coach)

    return ok(out)
