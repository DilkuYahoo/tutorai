import sys
from datetime import datetime, timezone
sys.path.insert(0, "/opt/python")

from shared.response import ok, preflight
from shared.auth import require_role
from shared import db
from shared.ids import today
from boto3.dynamodb.conditions import Attr
from collections import defaultdict
from decimal import Decimal


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    denied = require_role(event, "admin")
    if denied:
        return denied

    # ── Jobs ──────────────────────────────────────────────────────────────────
    jobs_resp = db.table().scan(
        FilterExpression=Attr("PK").begins_with("JOB#") & Attr("SK").eq("#META")
    )
    all_jobs = jobs_resp.get("Items", [])
    open_roles = sum(1 for j in all_jobs if j.get("status") == "Open")

    # ── Candidates ────────────────────────────────────────────────────────────
    cands_resp = db.table().scan(
        FilterExpression=Attr("PK").begins_with("CANDIDATE#") & Attr("SK").eq("#META")
    )
    total_candidates = cands_resp.get("Count", 0)

    # ── Applications ──────────────────────────────────────────────────────────
    apps_resp = db.table().scan(
        FilterExpression=Attr("PK").begins_with("APPLICATION#") & Attr("SK").eq("#META")
    )
    all_apps = apps_resp.get("Items", [])

    terminal = {"Hired", "Rejected"}
    in_pipeline = sum(1 for a in all_apps if a.get("stage") not in terminal)

    stage_counts = defaultdict(int)
    for a in all_apps:
        stage_counts[a.get("stage", "Unknown")] += 1

    stage_funnel = [
        {"stage": s, "count": stage_counts.get(s, 0)}
        for s in ["Applied", "Screening", "Interview", "Final Interview", "Offer", "Hired"]
    ]

    # Offer acceptance rate: Hired / (Hired + Rejected from Offer stage)
    hired_count = stage_counts.get("Hired", 0)
    offer_count = stage_counts.get("Offer", 0) + hired_count
    offer_acceptance_rate = round(hired_count / offer_count, 2) if offer_count > 0 else 0.0

    # ── Time-to-hire trend (rolling 8 weeks from hired apps) ─────────────────
    time_to_hire_trend = _compute_time_to_hire(all_apps)

    # ── Time-in-stage averages ────────────────────────────────────────────────
    time_in_stage = _compute_time_in_stage(all_apps)

    # ── Source breakdown ──────────────────────────────────────────────────────
    cands_all = cands_resp.get("Items", [])
    source_counts = defaultdict(int)
    for c in cands_all:
        source_counts[c.get("source", "Other")] += 1
    source_breakdown = [
        {"source": s, "count": c}
        for s, c in sorted(source_counts.items(), key=lambda x: -x[1])
    ]

    # ── Avg time to hire (overall) ────────────────────────────────────────────
    avg_days = _avg_time_to_hire(all_apps)

    metrics = {
        "asOf": today(),
        "openRoles": open_roles,
        "totalCandidates": total_candidates,
        "inPipeline": in_pipeline,
        "avgTimeToHireDays": avg_days,
        "offerAcceptanceRate": offer_acceptance_rate,
        "stageFunnel": stage_funnel,
        "timeToHireTrend": time_to_hire_trend,
        "timeInStage": time_in_stage,
        "sourceBreakdown": source_breakdown,
    }

    return ok(_clean(metrics))


def _avg_time_to_hire(apps):
    hired = [a for a in apps if a.get("stage") == "Hired" and a.get("appliedAt")]
    if not hired:
        return 0
    total_days = 0
    count = 0
    today_dt = datetime.now(timezone.utc)
    for a in hired:
        try:
            applied = datetime.fromisoformat(a["appliedAt"]).replace(tzinfo=timezone.utc)
            diff = (today_dt - applied).days
            total_days += diff
            count += 1
        except Exception:
            pass
    return round(total_days / count) if count else 0


def _compute_time_to_hire(apps):
    """Rolling 8-week average time-to-hire for hired applications."""
    from datetime import timedelta
    today_dt = datetime.now(timezone.utc)
    weeks = []
    for w in range(7, -1, -1):
        week_start = today_dt - timedelta(weeks=w + 1)
        week_end   = today_dt - timedelta(weeks=w)
        label = f"W{week_start.strftime('%d %b').lstrip('0')}"
        hired_in_week = [
            a for a in apps
            if a.get("stage") == "Hired" and a.get("appliedAt") and _in_window(a["appliedAt"], week_start, week_end)
        ]
        if hired_in_week:
            avg = sum(
                (week_end - datetime.fromisoformat(a["appliedAt"]).replace(tzinfo=timezone.utc)).days
                for a in hired_in_week
            ) / len(hired_in_week)
        else:
            avg = 0
        weeks.append({"week": label, "days": round(avg)})
    return weeks


def _compute_time_in_stage(apps):
    """Average days between stage transitions — requires reading stage history."""
    # Placeholder — full implementation requires fetching history items per app.
    # Returned as empty list for MVP; can be populated by a scheduled aggregation job.
    return []


def _in_window(date_str, start, end):
    try:
        dt = datetime.fromisoformat(date_str).replace(tzinfo=timezone.utc)
        return start <= dt < end
    except Exception:
        return False


def _clean(obj):
    """Recursively convert Decimal to float/int for JSON serialisation."""
    if isinstance(obj, list):
        return [_clean(i) for i in obj]
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    return obj
