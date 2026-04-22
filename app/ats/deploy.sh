#!/usr/bin/env bash
# ATS deployment script
#
# Usage:
#   ./deploy.sh backend    Build + deploy Lambda backend, then build + sync frontend
#   ./deploy.sh cf         Deploy/update the CloudFront + Route 53 stack (run once or after CF changes)
#
# Local development:
#   cd frontend && npm run dev   (no backend needed — frontend uses mock data)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
IAC_DIR="$SCRIPT_DIR/iac"
S3_BUCKET="advicelab"
S3_PREFIX="ats/web/prod"
AWS_REGION="ap-southeast-2"
CF_REGION="us-east-1"
CF_STACK_NAME="ats-cloudfront"
BACKEND_STACK="ats-prod"

# ── Helpers ───────────────────────────────────────────────────────────────────
cf_distribution_id() {
  aws cloudformation describe-stacks \
    --stack-name "$CF_STACK_NAME" \
    --region "$CF_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
    --output text 2>/dev/null || true
}

invalidate_cf() {
  local dist_id
  dist_id=$(cf_distribution_id)
  if [[ -n "$dist_id" ]]; then
    echo "▶ Invalidating CloudFront cache ..."
    aws cloudfront create-invalidation \
      --distribution-id "$dist_id" \
      --paths "/${S3_PREFIX}/*" \
      --query 'Invalidation.{Id:Id,Status:Status}' \
      --output table
  else
    echo "⚠  CloudFront distribution not found — skipping invalidation. Run './deploy.sh cf' first."
  fi
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

  local pool_id client_id
  pool_id=$(aws cloudformation describe-stacks \
    --stack-name "$BACKEND_STACK" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
    --output text 2>/dev/null || true)
  client_id=$(aws cloudformation describe-stacks \
    --stack-name "$BACKEND_STACK" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" \
    --output text 2>/dev/null || true)

  if [[ -n "$api_url" ]]; then
    echo "   VITE_API_URL=$api_url"
    echo "   VITE_COGNITO_USER_POOL_ID=$pool_id"
    echo "   VITE_COGNITO_CLIENT_ID=$client_id"
    {
      echo "VITE_API_URL=$api_url"
      echo "VITE_COGNITO_USER_POOL_ID=$pool_id"
      echo "VITE_COGNITO_CLIENT_ID=$client_id"
    } > .env.production
  else
    rm -f .env.production
    echo "   VITE_API_URL not set — using mock data"
  fi

  npm run build
  cd "$SCRIPT_DIR"
}

sync_frontend() {
  echo "▶ Syncing frontend to s3://${S3_BUCKET}/${S3_PREFIX}/ ..."

  # Hashed assets — long cache
  aws s3 sync "$FRONTEND_DIR/dist/" "s3://${S3_BUCKET}/${S3_PREFIX}/" \
    --delete \
    --region "$AWS_REGION" \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html"

  # index.html — never cache
  aws s3 cp "$FRONTEND_DIR/dist/index.html" "s3://${S3_BUCKET}/${S3_PREFIX}/index.html" \
    --region "$AWS_REGION" \
    --cache-control "no-cache,no-store,must-revalidate"

  echo "✔ Frontend synced to s3://${S3_BUCKET}/${S3_PREFIX}/"
}

# ── Commands ──────────────────────────────────────────────────────────────────
CMD="${1:-}"

case "$CMD" in

  # ── backend — deploy Lambda + build + sync frontend ───────────────────────
  backend)
    echo "▶ Building SAM ..."
    cd "$IAC_DIR"
    sam build
    echo "▶ Deploying Lambda backend (${BACKEND_STACK}) ..."
    sam deploy --no-fail-on-empty-changeset
    cd "$SCRIPT_DIR"
    echo "✔ Backend deployed"

    build_frontend
    sync_frontend
    invalidate_cf

    echo ""
    echo "══════════════════════════════════════════════════════"
    echo "  ✔ ATS → https://ats.advicelab.com.au"
    echo "══════════════════════════════════════════════════════"
    ;;

  # ── cf — CloudFront + Route 53 stack (run once or after CF changes) ───────
  cf)
    echo "▶ Backing up Route 53 zone ..."
    BACKUP_DIR="$IAC_DIR/backups"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/route53-advicelab-$(date +%Y%m%d-%H%M%S).json"
    aws route53 list-resource-record-sets \
      --hosted-zone-id Z0015604O8Z36ZXYJGP0 \
      --output json > "$BACKUP_FILE"
    echo "   Backed up to $BACKUP_FILE"

    echo "▶ Deploying CloudFront + Route 53 stack (us-east-1) ..."
    aws cloudformation deploy \
      --template-file "$IAC_DIR/cloudfront.yaml" \
      --stack-name "$CF_STACK_NAME" \
      --region "$CF_REGION" \
      --capabilities CAPABILITY_IAM \
      --no-fail-on-empty-changeset

    echo ""
    echo "✔ CloudFront stack deployed."
    aws cloudformation describe-stacks \
      --stack-name "$CF_STACK_NAME" \
      --region "$CF_REGION" \
      --query 'Stacks[0].Outputs' \
      --output table
    ;;

  *)
    echo "Usage: ./deploy.sh <backend|cf>"
    echo ""
    echo "  backend   Deploy Lambda + build + sync frontend → https://ats.advicelab.com.au"
    echo "  cf        Deploy/update CloudFront + DNS stack (run once or after CF changes)"
    exit 1
    ;;
esac
