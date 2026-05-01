import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timezone, timedelta

from shared.auth import get_user_id, get_role, is_coach_or_super
from shared.response import ok, forbidden, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    if not is_coach_or_super(event):
        return forbidden("Dashboard is for coaches only")

    role = get_role(event)
    user_id = get_user_id(event)
    params = event.get("queryStringParameters") or {}
    coach_filter = params.get("coachId")

    now_utc = datetime.now(timezone.utc)
    today_str = now_utc.date().isoformat()
    month_start = now_utc.replace(day=1).date().isoformat()

    if role == "super_coach" and coach_filter:
        target_coach = coach_filter
    elif role == "super_coach":
        target_coach = None  # All coaches
    else:
        target_coach = user_id

    def get_sessions_for_coach(coach_id):
        return db.query_gsi(
            index="GSI1",
            pk_name="GSI1PK",
            pk_value=f"COACH#{coach_id}",
            sk_name="GSI1SK",
            sk_prefix="SESSION#",
        )

    if target_coach:
        all_sessions = get_sessions_for_coach(target_coach)
    else:
        # All active coaches
        coaches = db.query_gsi(index="GSI1", pk_name="GSI1PK", pk_value="COACHES",
                                sk_name="GSI1SK", sk_prefix="active#")
        all_sessions = []
        for coach in coaches:
            all_sessions.extend(get_sessions_for_coach(coach["id"]))

    todays_sessions = [s for s in all_sessions
                       if s.get("scheduledAt", "")[:10] == today_str and s.get("status") == "booked"]
    upcoming_this_week = [s for s in all_sessions
                          if s.get("scheduledAt", "")[:10] > today_str
                          and s.get("scheduledAt", "")[:10] <= (now_utc + timedelta(days=7)).date().isoformat()
                          and s.get("status") == "booked"]
    completed_this_month = [s for s in all_sessions
                             if s.get("scheduledAt", "")[:10] >= month_start
                             and s.get("status") == "completed"]

    # Outstanding invoices
    invoices = db.query_gsi(index="GSI2", pk_name="GSI2PK", pk_value="INVOICES",
                             sk_name="GSI2SK", sk_prefix="pending#")
    if target_coach:
        invoices = [inv for inv in invoices if inv.get("coachId") == target_coach]
    outstanding_total = sum(float(inv.get("amount", 0)) for inv in invoices)

    # Video review flags
    video_flags = [s for s in all_sessions if s.get("videoReviewFlag")]

    def strip(item):
        return {k: v for k, v in item.items() if not k.startswith(("PK", "SK", "GSI"))}

    return ok({
        "todaysSessions": {
            "count": len(todays_sessions),
            "sessions": [strip(s) for s in todays_sessions],
        },
        "upcomingThisWeek": len(upcoming_this_week),
        "completedThisMonth": len(completed_this_month),
        "outstandingInvoices": {
            "count": len(invoices),
            "totalValue": outstanding_total,
            "invoices": [strip(inv) for inv in invoices],
        },
        "videoReviewFlags": len(video_flags),
    })
