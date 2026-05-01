#!/usr/bin/env bash
# Energy-Mate deployment script
#
# Usage:
#   ./deploy.sh backend    Build + deploy SAM stack, then build + sync frontend
#   ./deploy.sh frontend   Build + sync frontend only (uses existing stack outputs)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/../frontend"
IAC_DIR="$SCRIPT_DIR/iac"

STACK_NAME="energy-mate-prod"
REGION="ap-southeast-2"
S3_BUCKET="cognifylabs.ai"
S3_PREFIX="energy-mate/web"
CF_DIST_ID="${CF_DIST_ID:-}"  # Set this once CloudFront is configured

# ── Helpers ───────────────────────────────────────────────────────────────────

build_frontend() {
  echo "▶ Building frontend ..."
  cd "$FRONTEND_DIR"

  local api_url
  api_url=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
    --output text 2>/dev/null || true)

  if [[ -n "$api_url" && "$api_url" != "None" ]]; then
    echo "   VITE_API_URL=$api_url"
    VITE_API_URL="$api_url" npm run build
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

  if [[ -n "$CF_DIST_ID" ]]; then
    echo "▶ Invalidating CloudFront cache ..."
    aws cloudfront create-invalidation \
      --distribution-id "$CF_DIST_ID" \
      --paths "/${S3_PREFIX}/*" \
      --query "Invalidation.{Id:Id,Status:Status}" \
      --output table
  fi

  echo "✔ Frontend synced"
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_backend() {
  echo "▶ Building SAM stack ..."
  cd "$IAC_DIR"
  sam build
  echo "▶ Deploying SAM stack ($STACK_NAME) ..."
  sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
  cd "$SCRIPT_DIR"
  echo "✔ Backend deployed"

  echo ""
  echo "  Post-deploy: set SSM parameters if not already done:"
  echo "  aws ssm put-parameter --name /energy-mate/lv-api-key --value <KEY> --type SecureString --overwrite"
  echo "  aws ssm put-parameter --name /energy-mate/lv-partner-id --value <ID> --type SecureString --overwrite"
  echo "  aws ssm put-parameter --name /energy-mate/nmi --value <NMI> --type String --overwrite"
  echo ""

  build_frontend
  sync_frontend

  echo ""
  echo "══════════════════════════════════════════════════════"
  echo "  ✔ Energy-Mate deployed"
  aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --query "Stacks[0].Outputs" \
    --output table
  echo "══════════════════════════════════════════════════════"
}

cmd_frontend() {
  build_frontend
  sync_frontend
  echo "✔ Energy-Mate frontend deployed"
}

CMD="${1:-}"
case "$CMD" in
  backend)  cmd_backend ;;
  frontend) cmd_frontend ;;
  *)
    echo "Usage: $0 <backend|frontend>"
    echo ""
    echo "  backend    Build + deploy SAM stack, then build + sync frontend"
    echo "  frontend   Build + sync frontend only"
    exit 1
    ;;
esac
