"""
GET /distributions
Returns all CloudFront distribution IDs visible to this AWS account,
plus their domain name and any comment/alias as a label.
No auth required (Phase 5 will add Cognito).
"""

import boto3

try:
    from shared.response import ok, preflight, server_error
except ModuleNotFoundError:
    import os, sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
    from response import ok, preflight, server_error

cf_client = boto3.client("cloudfront")


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    try:
        items = []
        paginator = cf_client.get_paginator("list_distributions")
        for page in paginator.paginate():
            dist_list = page.get("DistributionList", {})
            for dist in dist_list.get("Items", []):
                aliases = dist.get("Aliases", {}).get("Items", [])
                label = aliases[0] if aliases else dist.get("Comment") or dist["DomainName"]
                items.append({
                    "id": dist["Id"],
                    "domainName": dist["DomainName"],
                    "label": label,
                    "status": dist["Status"],
                    "enabled": dist["Enabled"],
                })

        items.sort(key=lambda d: d["label"])
        return ok({"distributions": items})

    except Exception as e:
        return server_error(str(e))
