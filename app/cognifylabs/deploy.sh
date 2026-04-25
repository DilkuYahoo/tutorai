#!/usr/bin/env bash
# CognifyLabs CloudFront Monitor — deployment script
#
# Usage:
#   ./deploy.sh backend    Build + deploy Lambda backend + sync frontend to S3
#   ./deploy.sh cf         Show status of the CloudFront distribution (setup already done)
#
# Local development:
#   cd frontend && npm run dev   (no backend needed — frontend uses mock data)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
IAC_DIR="$SCRIPT_DIR/iac"
S3_BUCKET="cognifylabs.ai"
S3_PREFIX="platform_monitor/web"
AWS_REGION="ap-southeast-2"
CF_REGION="us-east-1"
CF_DIST_ID="E1NBX4FPI2AYJ5"
BACKEND_STACK="platform-monitor"

# ── Helpers ───────────────────────────────────────────────────────────────────
invalidate_cf() {
  echo "▶ Invalidating CloudFront cache ..."
  aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST_ID" \
    --paths "/${S3_PREFIX}/*" \
    --query 'Invalidation.{Id:Id,Status:Status}' \
    --output table
}

build_frontend() {
  echo "▶ Building frontend ..."
  cd "$FRONTEND_DIR"

  local api_url
  api_url=$(aws cloudformation describe-stacks \
    --stack-name "$BACKEND_STACK" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text 2>/dev/null || true)

  if [[ -n "$api_url" ]]; then
    echo "   VITE_API_URL=$api_url"
    echo "VITE_API_URL=$api_url" > .env.production
  else
    rm -f .env.production
    echo "   VITE_API_URL not set — using mock data"
  fi

  npm run build
  cd "$SCRIPT_DIR"
}

sync_frontend() {
  echo "▶ Syncing frontend to s3://${S3_BUCKET}/${S3_PREFIX}/ ..."

  aws s3 sync "$FRONTEND_DIR/dist/" "s3://${S3_BUCKET}/${S3_PREFIX}/" \
    --delete \
    --region "$AWS_REGION" \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html"

  aws s3 cp "$FRONTEND_DIR/dist/index.html" "s3://${S3_BUCKET}/${S3_PREFIX}/index.html" \
    --region "$AWS_REGION" \
    --cache-control "no-cache,no-store,must-revalidate"

  echo "✔ Frontend synced"
}

# ── Commands ──────────────────────────────────────────────────────────────────
CMD="${1:-}"

case "$CMD" in

  backend)
    echo "▶ Building SAM ..."
    cd "$IAC_DIR"
    sam build
    echo "▶ Deploying backend (${BACKEND_STACK}) ..."
    sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
    cd "$SCRIPT_DIR"
    echo "✔ Backend deployed"

    build_frontend
    sync_frontend
    invalidate_cf

    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  ✔ CFMonitor deployed"
    aws cloudformation describe-stacks \
      --stack-name "$BACKEND_STACK" \
      --region "$AWS_REGION" \
      --query "Stacks[0].Outputs" \
      --output table
    echo "══════════════════════════════════════════════════════"
    ;;

  cf)
    # One-time setup: updates the existing cognifylabs.ai CloudFront distribution
    # (E1NBX4FPI2AYJ5) to serve monitor.cognifylabs.ai.
    # Safe to re-run — uses UPSERT for all changes.
    echo "▶ Checking distribution status ..."
    aws cloudfront get-distribution \
      --id "$CF_DIST_ID" \
      --region "$CF_REGION" \
      --query "Distribution.{Status:Status,Aliases:DistributionConfig.Aliases.Items}" \
      --output json

    echo ""
    echo "✔ monitor.cognifylabs.ai is served by distribution $CF_DIST_ID"
    echo "   Aliases:  cognifylabs.ai, www.cognifylabs.ai, monitor.cognifylabs.ai"
    echo "   Function: platform-monitor-spa-router (viewer-request)"
    echo "   Cert:     *.cognifylabs.ai (us-east-1)"
    echo ""
    echo "   Run './deploy.sh backend' to build and sync the frontend."
    ;;

  *)
    echo "Usage: ./deploy.sh <backend|cf>"
    echo ""
    echo "  backend   Build + deploy Lambda + sync frontend"
    echo "  cf        Deploy/update CloudFront + DNS stack (run once or after CF changes)"
    exit 1
    ;;
esac
