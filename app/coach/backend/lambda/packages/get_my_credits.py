import sys
sys.path.insert(0, "/opt/python")

from shared.auth import get_user_id, get_role
from shared.response import ok, forbidden, preflight
from shared import db


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    role = get_role(event)
    user_id = get_user_id(event)

    params = event.get("queryStringParameters") or {}

    if role == "parent":
        player_id = params.get("playerId")
        if not player_id:
            # Return credits for all children
            children = db.query_pk(f"PARENT#{user_id}", sk_prefix="CHILD#")
            result = []
            for child in children:
                pid = child.get("playerId")
                player = db.get_item(f"PLAYER#{pid}", "#META")
                if player:
                    result.append({
                        "playerId": pid,
                        "playerName": child.get("playerName"),
                        "balanceAvailable": player.get("balanceAvailable", 0),
                        "balanceCommitted": player.get("balanceCommitted", 0),
                        "totalPurchased": player.get("totalPurchased", 0),
                    })
            return ok(result)
        # Verify child belongs to parent
        link = db.get_item(f"PARENT#{user_id}", f"CHILD#{player_id}")
        if not link:
            return forbidden("That player is not your child")
        target_player_id = player_id
    elif role == "player":
        target_player_id = user_id
    else:
        return forbidden("Only players and parents can view credits")

    player = db.get_item(f"PLAYER#{target_player_id}", "#META")
    ledger = db.query_pk(f"CREDITS#{target_player_id}", scan_forward=False, limit=50)

    return ok({
        "balanceAvailable": player.get("balanceAvailable", 0) if player else 0,
        "balanceCommitted": player.get("balanceCommitted", 0) if player else 0,
        "totalPurchased": player.get("totalPurchased", 0) if player else 0,
        "ledger": [{k: v for k, v in e.items() if not k.startswith(("PK", "SK", "GSI"))}
                   for e in ledger],
    })
