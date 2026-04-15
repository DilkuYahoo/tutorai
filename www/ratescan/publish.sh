#!/bin/bash
# publish.sh — Build and deploy RateScan frontend to S3 + CloudFront
#
# Usage:
#   cd www/ratescan && ./publish.sh
#
# What this does:
#   1. Builds the Vite frontend (app/ratescan/frontend)
#   2. Uploads hashed JS/CSS assets with a 1-year immutable cache
#   3. Uploads root files (index.html, etc.) with no-cache
#   4. Invalidates only the root files in CloudFront (assets are versioned)
#
# ⚠️  IMPORTANT: The S3 bucket ratescan.com.au is SHARED with the data pipeline.
#     Website files live under the www/ prefix. Do NOT sync to the bucket root
#     with --delete — it will wipe iceberg/, summaries/, cache/, config.json.

set -e

BUCKET_NAME="ratescan.com.au"
DISTRIBUTION_ID="E1J06U2P33MLHN"
FRONTEND_DIR="$(cd "$(dirname "$0")/../../app/ratescan/frontend" && pwd)"
DIST_DIR="$FRONTEND_DIR/dist"

# ── Preflight checks ───────────────────────────────────────────────────────────

if ! command -v aws &>/dev/null; then
  echo "Error: AWS CLI is not installed."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "Error: npm is not installed."
  exit 1
fi

if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "Error: Bucket $BUCKET_NAME not accessible."
  exit 1
fi

# ── Build ──────────────────────────────────────────────────────────────────────

echo "→ Building frontend..."
cd "$FRONTEND_DIR"
npm run build
cd - > /dev/null

echo "→ Build complete: $DIST_DIR"

# ── Upload hashed assets (JS/CSS) — cache 1 year ──────────────────────────────
# Vite embeds a content hash in every asset filename (e.g. index-B3VOhiNg.js).
# Safe to cache indefinitely; the hash changes whenever the file changes.

echo "→ Uploading hashed assets (max-age=31536000)..."
aws s3 sync "$DIST_DIR/assets/" "s3://$BUCKET_NAME/www/assets/" \
  --cache-control "max-age=31536000, immutable"

# ── Upload root files — no cache ───────────────────────────────────────────────
# index.html, robots.txt, sitemap.xml, og-image.svg.
# --delete is safe here because www/ only contains web files.

echo "→ Uploading root files (no-cache)..."
aws s3 sync "$DIST_DIR/" "s3://$BUCKET_NAME/www/" \
  --delete \
  --exclude "assets/*" \
  --cache-control "no-cache, no-store, must-revalidate"

# ── CloudFront invalidation ────────────────────────────────────────────────────
# Only invalidate root files. Hashed assets get new URLs on each build so
# they don't need invalidation — CloudFront will fetch them on first request.

echo "→ Invalidating CloudFront distribution $DISTRIBUTION_ID..."
INVALIDATION=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/index.html" "/sitemap.xml" "/robots.txt" "/og-image.svg" "/favicon.svg")

echo "$INVALIDATION"
echo ""
echo "✓ Deployed to https://ratescan.com.au"
