# CognifyLabs CloudFront Monitor — Claude Context

## What this project is

An internal monitoring dashboard that ingests AWS CloudFront access logs and visualises traffic patterns — total requests, unique IPs, cache hit/miss ratio, status codes, user agents, and a geographic map. Monitoring only; no traffic blocking.

---

## Repo structure

```
app/cognifylabs/
├── deploy.sh                    # Single entrypoint for all deployments
├── scope.md                     # Requirements and implementation plan
├── CLAUDE.md                    # This file
├── frontend/                    # React + Vite SPA (Phase 3 — not yet built)
├── lambda/
│   ├── shared/                  # Lambda Layer: db.py, response.py, ids.py
│   ├── logs/                    # ingest_logs.py (S3 trigger), query_logs.py (API)
│   ├── distributions/           # list_distributions.py
│   └── geo/                     # query_geo.py
└── iac/
    ├── template.yaml            # SAM: DynamoDB, S3 bucket, API GW, all Lambdas
    ├── samconfig.toml           # SAM config — stack: platform_monitor-prod, region: ap-southeast-2
    └── cloudfront.yaml          # CloudFront + Route 53 (deployed to us-east-1) — Phase 3
```

---

## AWS infrastructure

- Region: ap-southeast-2 (Lambda/API/DynamoDB); us-east-1 (CloudFront + ACM)
- SAM stack: `platform_monitor-prod`
- S3 log bucket: `cognifylabs-cloudfront-logs` (CloudFront delivers access logs here)
- DynamoDB table: `platform_monitor-prod` (single-table, TTL 90 days on all log records)
- Lambda functions: Python 3.13, arm64, 256 MB / 15s (query Lambdas: 29s timeout)
- Lambda Layer: `platform_monitor-shared`

---

## API endpoints (all public — no auth until Phase 5)

Base URL resolved from SAM stack output `ApiUrl`.

| Method | Path | Function | Notes |
|--------|------|----------|-------|
| GET | /distributions | list_distributions | Lists all CF distributions in the account |
| GET | /logs/metrics | query_logs | Aggregated metrics for a distribution + time window |
| GET | /logs/geo | query_geo | Per-country request counts for the map |

### Query parameters — /logs/metrics and /logs/geo

| Param | Required | Default | Notes |
|-------|----------|---------|-------|
| distributionId | No | `all` | CF distribution ID or `all` |
| from | No | 24h ago | ISO 8601 UTC |
| to | No | now | ISO 8601 UTC |

---

## DynamoDB schema

Single-table design. All log records have a `ttl` attribute (90-day TTL).

| PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK | Purpose |
|----|----|--------|--------|--------|--------|---------|
| `DIST#{distId}` | `LOG#{timestamp}#{requestId}` | `DIST#{distId}` | `{timestamp}` | `DATE#{yyyy-mm-dd}` | `{distId}#{timestamp}` | One item per CF log line |

**Access patterns:**
- Time-range per distribution → GSI1: `GSI1PK = DIST#{id}`, `GSI1SK BETWEEN from AND to`
- All traffic for a date (across all distributions) → GSI2: `GSI2PK = DATE#{date}`

---

## Log ingestion

CloudFront delivers gzip-compressed W3C extended log files to `cognifylabs-cloudfront-logs`.
An S3 `ObjectCreated` event triggers `ingest_logs.py`, which:
1. Downloads and decompresses the log file
2. Parses each TSV line into a structured dict
3. Writes one DynamoDB item per request (`put_item`)
4. Sets a 90-day TTL on every item

The distribution ID is extracted from the log filename prefix (e.g. `EXXXXXXXXXXXXX.2024-01-15-12.abc123.gz`).

---

## Geographic resolution

`query_geo.py` resolves traffic location using:
1. **CloudFront edge location code** (first 3 chars of `x-edge-location`) → hardcoded map of ~30 common edge codes to country/lat/lon
2. **IP lookup fallback** via `ipapi.co` public API (no key needed, low volume only) — cached in Lambda memory for the duration of the invocation

---

## Deploy commands

```bash
# Build + deploy Lambda backend + build + sync frontend to S3
./deploy.sh backend

# Deploy/update the CloudFront + Route 53 stack (run once, or after CF changes)
./deploy.sh cf
```

Never run `sam deploy` manually.

---

## Key decisions — do not reverse without discussion

### Dashboard is public (no auth) until Phase 5
All API Gateway routes have no authoriser. Cognito is added in Phase 5 only. Do not add auth earlier.

### TTL on all log records
Every DynamoDB item written by `ingest_logs.py` has a `ttl` field set to 90 days from ingestion. This keeps the table lean without manual cleanup.

### Distribution ID from filename, not path
CloudFront log filenames are formatted as `{distributionId}.{datetime}.{uniqueId}.gz`. The ingestor extracts the distribution ID from `filename.split(".")[0]`. Do not rely on the S3 key path.

### geo resolution uses edge location first, IP fallback second
The `x-edge-location` field (e.g. `SYD50-C1`) is faster and cheaper than an IP lookup. The hardcoded edge map covers the ~30 most common locations. Only unknown codes fall back to `ipapi.co`.

### query_logs + query_geo timeout is 29s
These Lambdas aggregate potentially thousands of DynamoDB records. The timeout is set to 29s (API Gateway HTTP API maximum is 30s). If queries grow too slow, add pre-aggregation or an Athena fallback.

### CloudFront stack in us-east-1
ACM certificates for CloudFront must be in us-east-1. `deploy.sh cf` targets us-east-1 automatically.
