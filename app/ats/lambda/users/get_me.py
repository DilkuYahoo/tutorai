import sys
sys.path.insert(0, "/opt/python")

from shared.response import ok, bad_request, preflight
from shared.auth import get_claims, get_user_id, get_role
from shared.ids import utc_now
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    claims = get_claims(event)
    user_id = get_user_id(event)
    if not user_id:
        return bad_request("Missing user identity")

    # Try to get existing profile
    item = db.get_item(f"USER#{user_id}", "#META")

    if not item:
        # First login — create profile from Cognito claims
        name = claims.get("name", claims.get("email", "Unknown"))
        email = claims.get("email", "")
        role = get_role(event)
        initials = "".join(p[0].upper() for p in name.split()[:2]) if name else "?"

        item = {
            "PK": f"USER#{user_id}",
            "SK": "#META",
            "id": user_id,
            "name": name,
            "email": email,
            "role": role,
            "avatarInitials": initials,
            "department": claims.get("custom:department", ""),
            "createdAt": utc_now(),
        }
        db.put_item(item)

    profile = {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}
    return ok(profile)
