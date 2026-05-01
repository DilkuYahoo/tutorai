SESSION_STATUSES = ["booked", "completed", "cancelled", "rescheduled"]
LEDGER_TYPES = [
    "purchase",
    "booking_reserve",
    "session_complete",
    "cancellation_return",
    "late_cancel_forfeit",
    "manual_adjustment",
]
PACKAGE_TIERS = ["Trial", "Standard", "Premium"]
COACH_ROLES = ["coach", "super_coach"]
VIDEO_STATUSES = ["uploading", "uploaded", "failed"]
SLOT_DURATION_MINUTES = 45
DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
CANCELLATION_WINDOW_HOURS = 24
LOW_CREDIT_THRESHOLD = 2


class ValidationError(Exception):
    pass


def require_fields(body: dict, fields: list[str]):
    missing = [f for f in fields if body.get(f) is None or body.get(f) == ""]
    if missing:
        raise ValidationError(f"Missing required fields: {', '.join(missing)}")


def require_enum(value, allowed: list, field: str):
    if value not in allowed:
        raise ValidationError(f"Invalid {field}: '{value}'. Must be one of: {', '.join(str(a) for a in allowed)}")
