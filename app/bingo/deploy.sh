#!/usr/bin/env bash
# Bingo — deploy to cognifylabs.com.au/bingo/
#
# Usage:
#   ./deploy.sh          Build and deploy
#   ./deploy.sh check    Show CloudFront distribution details only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S3_BUCKET="cognifylabs.com.au"
S3_PREFIX="bingo"
AWS_REGION="ap-southeast-2"
CF_DIST_ID="E2R300A901V4FK"

# ── Helpers ───────────────────────────────────────────────────────────────────
check_deps() {
  for cmd in aws npm node; do
    if ! command -v "$cmd" &>/dev/null; then
      echo "✘ '$cmd' not found — please install it first"
      exit 1
    fi
  done
}

check_cf() {
  echo "▶ CloudFront distribution check ..."
  aws cloudfront get-distribution \
    --id "$CF_DIST_ID" \
    --query "Distribution.{Id:Id,Status:Status,Domain:DomainName,Aliases:DistributionConfig.Aliases.Items,S3Origin:Origins.Items[0].DomainName}" \
    --output table
}

build() {
  echo "▶ Building frontend ..."
  cd "$SCRIPT_DIR"

  # Set base path so assets resolve correctly under /bingo/
  VITE_BASE="/bingo/" npm run build -- --base "/bingo/"

  echo "✔ Build complete → dist/"
}

deploy() {
  echo "▶ Syncing to s3://${S3_BUCKET}/${S3_PREFIX}/ ..."

  # Static assets — long-lived cache
  aws s3 sync "$SCRIPT_DIR/dist/" "s3://${S3_BUCKET}/${S3_PREFIX}/" \
    --delete \
    --region "$AWS_REGION" \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "index.html"

  # index.html — no cache so deploys are instant
  aws s3 cp "$SCRIPT_DIR/dist/index.html" "s3://${S3_BUCKET}/${S3_PREFIX}/index.html" \
    --region "$AWS_REGION" \
    --cache-control "no-cache,no-store,must-revalidate"

  echo "✔ Files synced"
}

invalidate() {
  echo "▶ Invalidating CloudFront cache for /${S3_PREFIX}/* ..."
  aws cloudfront create-invalidation \
    --distribution-id "$CF_DIST_ID" \
    --paths "/${S3_PREFIX}/*" "/${S3_PREFIX}/index.html" \
    --query "Invalidation.{Id:Id,Status:Status}" \
    --output table
}

# ── Entry point ───────────────────────────────────────────────────────────────
CMD="${1:-deploy}"

check_deps

case "$CMD" in
  check)
    check_cf
    ;;
  deploy)
    check_cf
    build
    deploy
    invalidate
    echo ""
    echo "══════════════════════════════════════════════════"
    echo "  ✔ Bingo deployed to https://cognifylabs.com.au/bingo/"
    echo "══════════════════════════════════════════════════"
    ;;
  *)
    echo "Usage: ./deploy.sh [deploy|check]"
    exit 1
    ;;
esac
