"""
Three-layer availability resolver for coach slots.

Layer 1: Weekly template (recurring working hours split into 45-min slots)
Layer 2: Ad-hoc overrides (additions and removals per date)
Layer 3: Block-out periods (full date-range unavailability, overrides everything)

A slot is bookable if it is in Layer 1 or 2 AND not covered by Layer 3
AND not already booked by another player.
"""
from datetime import date, datetime, timedelta, timezone
from typing import List

from shared import db

SLOT_DURATION = 45  # minutes
DAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}


def _parse_date(d: str) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def _time_to_minutes(t: str) -> int:
    """Convert 'HH:MM' to minutes-since-midnight."""
    h, m = map(int, t.split(":"))
    return h * 60 + m


def _minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def _generate_template_slots(template: dict, target_date: date) -> List[str]:
    """Generate 45-min slot times (HH:MM) from the weekly template for a given date."""
    day_name = target_date.strftime("%A").lower()
    windows = template.get("windows", {}).get(day_name, [])
    slots = []
    for window in windows:
        start_m = _time_to_minutes(window["start"])
        end_m = _time_to_minutes(window["end"])
        cursor = start_m
        while cursor + SLOT_DURATION <= end_m:
            slots.append(_minutes_to_time(cursor))
            cursor += SLOT_DURATION
    return slots


def resolve_available_slots(coach_id: str, date_from: str, date_to: str) -> List[dict]:
    """
    Return all bookable slots for coach_id between date_from and date_to (inclusive).
    Each slot: {"date": "YYYY-MM-DD", "time": "HH:MM", "endsAt": "HH:MM"}
    """
    start = _parse_date(date_from)
    end = _parse_date(date_to)

    # Load weekly template
    template_item = db.get_item(f"COACH#{coach_id}", "AVAIL#TEMPLATE")
    template = template_item or {}

    # Load all overrides (additions and removals) in range
    overrides_raw = db.query_pk(
        f"COACH#{coach_id}",
        sk_prefix=f"AVAIL#OVERRIDE#{date_from}",
    )
    # Also need overrides up to date_to — do a second query or use between
    overrides_raw += db.query_pk_between(
        f"COACH#{coach_id}",
        sk_start=f"AVAIL#OVERRIDE#{date_from}",
        sk_end=f"AVAIL#OVERRIDE#{date_to}~",
    )
    # Deduplicate by SK
    seen_sks = set()
    overrides = []
    for o in overrides_raw:
        if o["SK"] not in seen_sks:
            seen_sks.add(o["SK"])
            overrides.append(o)

    additions: dict[str, set] = {}
    removals: dict[str, set] = {}
    for o in overrides:
        d = o.get("date")
        t = o.get("slotTime")
        if d and t:
            if o.get("type") == "add":
                additions.setdefault(d, set()).add(t)
            elif o.get("type") == "remove":
                removals.setdefault(d, set()).add(t)

    # Load block-outs
    blockouts = db.query_pk(f"COACH#{coach_id}", sk_prefix="BLOCKOUT#")

    def is_blocked(d: date) -> bool:
        ds = d.isoformat()
        for b in blockouts:
            if b.get("startDate", "") <= ds <= b.get("endDate", ""):
                return True
        return False

    # Load all booked sessions in range to mark slots taken
    booked_sessions = db.query_gsi(
        index="GSI1",
        pk_name="GSI1PK",
        pk_value=f"COACH#{coach_id}",
        sk_name="GSI1SK",
        sk_prefix="SESSION#",
    )
    booked_slots: dict[str, set] = {}
    for s in booked_sessions:
        if s.get("status") not in ("booked", "completed"):
            continue
        scheduled_at = s.get("scheduledAt", "")
        if not scheduled_at:
            continue
        try:
            dt = datetime.fromisoformat(scheduled_at)
            d_str = dt.date().isoformat()
            t_str = dt.strftime("%H:%M")
            booked_slots.setdefault(d_str, set()).add(t_str)
        except ValueError:
            pass

    result = []
    cursor = start
    while cursor <= end:
        d_str = cursor.isoformat()

        if not is_blocked(cursor):
            # Layer 1: template slots for this day
            day_slots = set(_generate_template_slots(template, cursor))
            # Layer 2: add additions, remove removals
            day_slots |= additions.get(d_str, set())
            day_slots -= removals.get(d_str, set())
            # Remove already booked
            day_slots -= booked_slots.get(d_str, set())

            for t in sorted(day_slots):
                end_minutes = _time_to_minutes(t) + SLOT_DURATION
                result.append({
                    "date": d_str,
                    "time": t,
                    "endsAt": _minutes_to_time(end_minutes),
                    "scheduledAt": f"{d_str}T{t}:00+10:00",
                })

        cursor += timedelta(days=1)

    return result


def check_conflicts(coach_id: str, proposed_dates: List[str], proposed_time: str) -> List[str]:
    """
    Given a list of YYYY-MM-DD dates and an HH:MM time, return the dates
    that conflict (not bookable). Used for recurring series conflict detection.
    """
    if not proposed_dates:
        return []
    date_from = min(proposed_dates)
    date_to = max(proposed_dates)
    available = resolve_available_slots(coach_id, date_from, date_to)
    available_set = {(s["date"], s["time"]) for s in available}
    return [d for d in proposed_dates if (d, proposed_time) not in available_set]
