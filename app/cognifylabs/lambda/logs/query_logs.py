"""
GET /logs/metrics?distributionId=EXXXX&from=...&to=...

Returns aggregated metrics for the given distribution + time window.
distributionId=all aggregates across all distributions.
"""

import os
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

try:
    from shared.db import query_gsi
    from shared.response import ok, preflight, server_error
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
    from db import query_gsi
    from response import ok, preflight, server_error

# Known bot UA patterns
BOT_PATTERNS = re.compile(
    r'bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu|duckduck'
    r'|semrush|ahrefs|moz|pingdom|uptimerobot|python-requests|curl|wget|go-http|java/',
    re.IGNORECASE
)


def _now():
    return datetime.now(timezone.utc)


def _parse_ts(s):
    return datetime.fromisoformat(s.rstrip("Z")).replace(tzinfo=timezone.utc)


def _hour_bucket(ts):
    return ts[:13] + ":00:00Z"


def _referrer_domain(referrer):
    if not referrer or referrer == "-":
        return "direct"
    try:
        host = urlparse(referrer).netloc
        return host or "direct"
    except Exception:
        return "direct"


def _aggregate(items):
    total = len(items)
    if total == 0:
        return _empty()

    unique_ips   = set()
    cache_hits   = 0
    bandwidth    = 0
    time_total   = 0.0
    time_count   = 0

    status_groups   = defaultdict(int)
    hourly          = defaultdict(int)
    ua_counts       = defaultdict(int)
    url_counts      = defaultdict(int)
    ip_counts       = defaultdict(int)
    referrer_counts = defaultdict(int)
    edge_counts     = defaultdict(int)
    protocol_counts = defaultdict(int)
    version_counts  = defaultdict(int)
    bot_count       = 0
    human_count     = 0

    for item in items:
        ip = item.get("clientIp", "-")
        if ip and ip != "-":
            unique_ips.add(ip)
            ip_counts[ip] += 1

        if item.get("cacheHit"):
            cache_hits += 1

        b = item.get("bytes", 0)
        try:
            bandwidth += int(b)
        except (TypeError, ValueError):
            pass

        tt = item.get("timeTaken", "0")
        try:
            time_total += float(tt)
            time_count += 1
        except (TypeError, ValueError):
            pass

        status_groups[item.get("statusGroup", "unknown")] += 1

        bucket = _hour_bucket(item.get("timestamp", ""))
        if bucket:
            hourly[bucket] += 1

        ua = item.get("userAgent", "-")
        if ua and ua != "-":
            ua_counts[ua] += 1
            if BOT_PATTERNS.search(ua):
                bot_count += 1
            else:
                human_count += 1
        else:
            human_count += 1

        uri = item.get("uriStem", "-")
        if uri and uri != "-":
            url_counts[uri] += 1

        ref = _referrer_domain(item.get("referrer", "-"))
        referrer_counts[ref] += 1

        edge = item.get("edgeLocation", "-")
        if edge and edge != "-":
            edge_counts[edge[:3]] += 1

        proto = item.get("protocol", "-")
        if proto and proto != "-":
            protocol_counts[proto.upper()] += 1

        ver = item.get("protocolVersion", "-")
        if ver and ver != "-":
            version_counts[ver] += 1

    cache_misses = total - cache_hits
    hit_ratio    = round(cache_hits / total * 100, 1) if total else 0.0
    avg_time     = round(time_total / time_count * 1000, 1) if time_count else 0.0  # ms

    top_uas   = sorted(ua_counts.items(),       key=lambda x: x[1], reverse=True)[:10]
    top_urls  = sorted(url_counts.items(),      key=lambda x: x[1], reverse=True)[:10]
    top_ips   = sorted(ip_counts.items(),       key=lambda x: x[1], reverse=True)[:10]
    top_refs  = sorted(referrer_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    top_edges = sorted(edge_counts.items(),     key=lambda x: x[1], reverse=True)[:10]

    peak = max(hourly.items(), key=lambda x: x[1]) if hourly else (None, 0)

    return {
        "totalRequests":    total,
        "uniqueIps":        len(unique_ips),
        "cacheHits":        cache_hits,
        "cacheMisses":      cache_misses,
        "cacheHitRatio":    hit_ratio,
        "bandwidth":        bandwidth,
        "avgResponseTimeMs": avg_time,
        "statusGroups":     dict(status_groups),
        "requestsOverTime": [{"timestamp": ts, "count": c} for ts, c in sorted(hourly.items())],
        "topUserAgents":    [{"userAgent": ua, "count": c} for ua, c in top_uas],
        "topUrls":          [{"url": u, "count": c} for u, c in top_urls],
        "topIps":           [{"ip": ip, "count": c} for ip, c in top_ips],
        "topReferrers":     [{"referrer": r, "count": c} for r, c in top_refs],
        "topEdgeLocations": [{"location": e, "count": c} for e, c in top_edges],
        "protocolSplit":    dict(protocol_counts),
        "httpVersions":     dict(version_counts),
        "botVsHuman":       {"bot": bot_count, "human": human_count},
        "peakHour":         {"hour": peak[0], "count": peak[1]},
    }


def _empty():
    return {
        "totalRequests": 0, "uniqueIps": 0, "cacheHits": 0, "cacheMisses": 0,
        "cacheHitRatio": 0.0, "bandwidth": 0, "avgResponseTimeMs": 0.0,
        "statusGroups": {}, "requestsOverTime": [], "topUserAgents": [],
        "topUrls": [], "topIps": [], "topReferrers": [], "topEdgeLocations": [],
        "protocolSplit": {}, "httpVersions": {}, "botVsHuman": {"bot": 0, "human": 0},
        "peakHour": {"hour": None, "count": 0},
    }


def _fetch_items(distribution_id, from_str, to_str):
    if distribution_id == "all":
        from_dt = _parse_ts(from_str)
        to_dt   = _parse_ts(to_str)
        dates   = set()
        cursor  = from_dt.date()
        while cursor <= to_dt.date():
            dates.add(str(cursor))
            cursor = (datetime.combine(cursor, datetime.min.time(), timezone.utc) + timedelta(days=1)).date()
        raw = []
        for d in dates:
            raw.extend(query_gsi("GSI2", "GSI2PK", f"DATE#{d}"))
        return [i for i in raw if from_str <= i.get("timestamp", "") <= to_str]
    else:
        return query_gsi(
            "GSI1", "GSI1PK", f"DIST#{distribution_id}",
            sk_name="GSI1SK", sk_between=(from_str, to_str),
        )


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    try:
        params          = event.get("queryStringParameters") or {}
        distribution_id = params.get("distributionId", "all")
        now             = _now()
        from_dt         = _parse_ts(params["from"]) if params.get("from") else now - timedelta(hours=24)
        to_dt           = _parse_ts(params["to"])   if params.get("to")   else now
        from_str        = from_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        to_str          = to_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        items  = _fetch_items(distribution_id, from_str, to_str)
        result = _aggregate(items)

        # Previous period for day-over-day comparison
        window   = to_dt - from_dt
        prev_to  = from_dt
        prev_from = from_dt - window
        prev_items = _fetch_items(
            distribution_id,
            prev_from.strftime("%Y-%m-%dT%H:%M:%SZ"),
            prev_to.strftime("%Y-%m-%dT%H:%M:%SZ"),
        )
        result["previousPeriodRequests"] = len(prev_items)

        return ok(result)

    except Exception as e:
        return server_error(str(e))
