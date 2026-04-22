PIPELINE_STAGES = [
    "Applied",
    "Screening",
    "Interview",
    "Final Interview",
    "Offer",
    "Hired",
    "Rejected",
]

JOB_STATUSES = ["Draft", "Open", "Closed", "On Hold", "Archived"]

EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Casual"]

INTERVIEW_TYPES = ["Phone", "Video", "In-person"]

INTERVIEW_STATUSES = ["Scheduled", "Completed", "Cancelled", "No-show"]

FEEDBACK_RECOMMENDATIONS = ["Advance", "Hold", "Reject"]


class ValidationError(Exception):
    pass


def require_fields(body: dict, fields: list[str]):
    missing = [f for f in fields if not body.get(f)]
    if missing:
        raise ValidationError(f"Missing required fields: {', '.join(missing)}")


def require_enum(value, allowed: list, field: str):
    if value not in allowed:
        raise ValidationError(f"Invalid {field}: '{value}'. Must be one of: {', '.join(allowed)}")
