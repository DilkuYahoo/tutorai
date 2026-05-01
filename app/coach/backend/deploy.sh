#!/usr/bin/env bash
# Playgenie deployment script
#
# Usage:
#   ./deploy.sh frontend   Build + sync mock-data frontend to S3 (no backend needed)
#   ./deploy.sh backend    Build + deploy SAM stack, then build + sync frontend with real API
#   ./deploy.sh cf         Update CF Function routing + add coachgenie alias to distribution
#   ./deploy.sh all        Run backend then cf
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
IAC_DIR="$SCRIPT_DIR/iac"

STACK_NAME="playgenie-prod"
REGION="ap-southeast-2"
CF_REGION="us-east-1"
S3_BUCKET="cognifylabs.ai"
S3_PREFIX="coachgenie/web"
CF_DIST_ID="E1NBX4FPI2AYJ5"
CF_FUNCTION_NAME="platform-monitor-spa-router"

# ── Helpers ───────────────────────────────────────────────────────────────────

build_frontend() {
  echo "▶ Building frontend ..."
  cd "$FRONTEND_DIR"

  local api_url user_pool_id user_pool_client_id
  api_url=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text 2>/dev/null || true)

  if [[ -n "$api_url" && "$api_url" != "None" ]]; then
    user_pool_id=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" --region "$REGION" \
      --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
      --output text)
    user_pool_client_id=$(aws cloudformation describe-stacks \
      --stack-name "$STACK_NAME" --region "$REGION" \
      --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
      --output text)
    echo "   VITE_API_URL=$api_url"
    VITE_API_URL="$api_url" \
    VITE_USER_POOL_ID="$user_pool_id" \
    VITE_USER_POOL_CLIENT_ID="$user_pool_client_id" \
    npm run build
  else
    echo "   Stack not deployed — building with mock data"
    npm run build
  fi

  cd "$SCRIPT_DIR"
}

sync_frontend() {
  echo "▶ Syncing frontend to s3://${S3_BUCKET}/${S3_PREFIX}/ ..."

  aws s3 sync "$FRONTEND_DIR/dist/" "s3://${S3_BUCKET}/${S3_PREFIX}/" \
    --delete \
    --region "$REGION" \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html"

  aws s3 cp "$FRONTEND_DIR/dist/index.html" "s3://${S3_BUCKET}/${S3_PREFIX}/index.html" \
    --region "$REGION" \
    --cache-control "no-cache,no-store,must-revalidate"

  echo "✔ Frontend synced to s3://${S3_BUCKET}/${S3_PREFIX}/"
}

invalidate_cf() {
  echo "▶ Invalidating CloudFront cache ..."
  aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST_ID" \
    --paths "/${S3_PREFIX}/*" \
    --query "Invalidation.{Id:Id,Status:Status}" \
    --output table
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_frontend() {
  build_frontend
  sync_frontend
  invalidate_cf
  echo ""
  echo "✔ Playgenie frontend deployed (mock data)"
  echo "  https://coachgenie.cognifylabs.ai  (once CF is configured)"
}

cmd_backend() {
  echo "▶ Building SAM stack ..."
  cd "$IAC_DIR"
  sam build
  echo "▶ Deploying SAM stack ($STACK_NAME) ..."
  sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
  cd "$SCRIPT_DIR"
  echo "✔ Backend deployed"

  build_frontend
  sync_frontend
  invalidate_cf

  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  ✔ Playgenie deployed"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs" \
    --output table
  echo "══════════════════════════════════════════════════════"
}

cmd_cf() {
  echo "▶ Step 1 — Updating CloudFront Function ($CF_FUNCTION_NAME) ..."

  ETAG=$(aws cloudfront describe-function \
    --name "$CF_FUNCTION_NAME" \
    --region "$CF_REGION" \
    --query "ETag" \
    --output text)

  ETAG=$(aws cloudfront update-function \
    --name "$CF_FUNCTION_NAME" \
    --function-config "Comment=Routes monitor + coachgenie subdomains,Runtime=cloudfront-js-2.0" \
    --function-code "fileb://$IAC_DIR/cf-function.js" \
    --if-match "$ETAG" \
    --region "$CF_REGION" \
    --query "ETag" \
    --output text)

  aws cloudfront publish-function \
    --name "$CF_FUNCTION_NAME" \
    --if-match "$ETAG" \
    --region "$CF_REGION"

  echo "✔ CF Function updated and published"

  echo ""
  echo "▶ Step 2 — Adding coachgenie.cognifylabs.ai alias to distribution $CF_DIST_ID ..."

  # Fetch full distribution config
  RAW=$(aws cloudfront get-distribution-config --id "$CF_DIST_ID" --region "$CF_REGION")
  DIST_ETAG=$(echo "$RAW" | python3 -c "import sys,json; print(json.load(sys.stdin)['ETag'])")

  # Splice coachgenie alias in if not already present, write to temp file
  echo "$RAW" | python3 - <<'PYEOF'
import sys, json

data = json.load(sys.stdin)
cfg = data["DistributionConfig"]
aliases = cfg.setdefault("Aliases", {"Quantity": 0, "Items": []})
items = aliases.get("Items", [])

if "coachgenie.cognifylabs.ai" not in items:
    items.append("coachgenie.cognifylabs.ai")
    aliases["Items"] = items
    aliases["Quantity"] = len(items)
    print(f"  Added alias. Quantity now: {aliases['Quantity']}", file=sys.stderr)
else:
    print("  Alias already present — no change needed.", file=sys.stderr)

with open("/tmp/pg_cf_config.json", "w") as f:
    json.dump(cfg, f)
PYEOF

  aws cloudfront update-distribution \
    --id "$CF_DIST_ID" \
    --distribution-config "file:///tmp/pg_cf_config.json" \
    --if-match "$DIST_ETAG" \
    --region "$CF_REGION" \
    --query "Distribution.{Status:Status,Aliases:DistributionConfig.Aliases.Items}" \
    --output json

  echo ""
  echo "✔ CloudFront configuration complete!"
  echo "  Distribution: $CF_DIST_ID"
  echo "  URL:          https://coachgenie.cognifylabs.ai"
  echo "  Note: allow 1–2 min for CF propagation before testing"
}

CMD="${1:-}"
case "$CMD" in
  frontend) cmd_frontend ;;
  backend)  cmd_backend ;;
  cf)       cmd_cf ;;
  all)      cmd_backend; cmd_cf ;;
  *)
    echo "Usage: $0 <frontend|backend|cf|all>"
    echo ""
    echo "  frontend   Build + sync mock-data frontend to S3"
    echo "  backend    Build + deploy SAM stack, then build + sync frontend"
    echo "  cf         Update CF Function routing + add coachgenie.cognifylabs.ai alias"
    echo "  all        Run backend then cf"
    exit 1
    ;;
esac
