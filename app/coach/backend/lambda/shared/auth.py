import os
from shared.response import forbidden

ROLES = ["super_coach", "coach", "player", "parent"]

_LOCAL_CLAIMS = {
    "sub": "local-dev-user",
    "email": "dev@local",
    "name": "Local Dev",
    "custom:role": "super_coach",
}


def get_claims(event: dict) -> dict:
    try:
        claims = event["requestContext"]["authorizer"]["jwt"]["claims"]
        if claims:
            return claims
    except (KeyError, TypeError):
        pass
    if os.environ.get("LOCAL_DEV") == "1":
        return _LOCAL_CLAIMS
    return {}


def get_user_id(event: dict) -> str:
    return get_claims(event).get("sub", "")


def get_role(event: dict) -> str:
    return get_claims(event).get("custom:role", "")


def get_user_name(event: dict) -> str:
    claims = get_claims(event)
    return claims.get("name", claims.get("email", "Unknown"))


def get_email(event: dict) -> str:
    return get_claims(event).get("email", "")


def require_role(event: dict, *allowed_roles: str):
    """Return a 403 response if the caller's role is not in allowed_roles, else None."""
    role = get_role(event)
    if role not in allowed_roles:
        return forbidden(f"Role '{role}' is not permitted for this action")
    return None


def is_super_coach(event: dict) -> bool:
    return get_role(event) == "super_coach"


def is_coach_or_super(event: dict) -> bool:
    return get_role(event) in ("coach", "super_coach")
