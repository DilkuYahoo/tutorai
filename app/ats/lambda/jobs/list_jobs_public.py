import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    items = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value="JOBS",
        sk_name="GSI1SK",
        sk_prefix="Open#",
        scan_forward=False,
    )

    PUBLIC_FIELDS = {"id", "title", "department", "location", "employmentType",
                     "salaryMin", "salaryMax", "salaryCurrency", "description",
                     "applicantCount", "createdAt", "status"}

    jobs = [{k: v for k, v in i.items() if k in PUBLIC_FIELDS} for i in items]
    return ok(jobs)
