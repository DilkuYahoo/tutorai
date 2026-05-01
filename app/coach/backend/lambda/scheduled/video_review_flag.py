"""
Daily scheduled Lambda — flags sessions where the coach has not responded
to a player-uploaded video within 3 days.
Runs at 2 AM AEST (16:00 UTC) via EventBridge Scheduler.
"""
import sys
sys.path.insert(0, "/opt/python")

from datetime import datetime, timezone, timedelta

from shared import db
from shared.ids import utc_now

REVIEW_THRESHOLD_DAYS = 3


def lambda_handler(event, context):
    cutoff = (datetime.now(timezone.utc) - timedelta(days=REVIEW_THRESHOLD_DAYS)).isoformat()

    # Find completed sessions that have player videos with no coach response
    # Using GSI3 to iterate all sessions by status/date
    sessions = db.query_gsi(
        index="GSI3",
        pk_name="GSI3PK",
        pk_value="SESSIONS",
        sk_name="GSI3SK",
        sk_prefix="completed#",
        scan_forward=False,
        limit=500,
    )

    flagged = 0
    cleared = 0
    now = utc_now()

    for session in sessions:
        # Only process sessions completed more than threshold days ago
        completed_at = session.get("completedAt", "")
        if not completed_at or completed_at > cutoff:
            continue

        session_id = session.get("id")
        if not session_id:
            continue

        videos = db.query_pk(f"SESSION#{session_id}", sk_prefix="VIDEO#")
        player_videos = [v for v in videos if v.get("uploaderType") == "player"
                         and v.get("status") == "uploaded"]

        if not player_videos:
            # No player videos — clear flag if set
            if session.get("videoReviewFlag"):
                db.update_item(f"SESSION#{session_id}", "#META",
                               {"videoReviewFlag": False})
                cleared += 1
            continue

        # Check if any player video has no coach response
        has_unreviewed = any(not v.get("coachResponse") for v in player_videos)

        if has_unreviewed and not session.get("videoReviewFlag"):
            db.update_item(f"SESSION#{session_id}", "#META",
                           {"videoReviewFlag": True, "videoReviewFlaggedAt": now})
            flagged += 1
        elif not has_unreviewed and session.get("videoReviewFlag"):
            db.update_item(f"SESSION#{session_id}", "#META",
                           {"videoReviewFlag": False})
            cleared += 1

    print(f"Video review flag run: flagged={flagged}, cleared={cleared}")
    return {"flagged": flagged, "cleared": cleared}
