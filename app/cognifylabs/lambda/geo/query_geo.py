"""
GET /logs/geo?distributionId=EXXXX&from=...&to=...

Returns per-country request counts for the geographic map.
Uses the CloudFront x-edge-location field to infer region,
and falls back to a lightweight IP-to-country lookup via the
ipapi.co public API (no key required for low volume).

Response:
  { "countries": [ { "country": "AU", "countryName": "Australia", "lat": -25.3, "lon": 133.8, "count": 1234 }, ... ] }
"""

import os
import json
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone

try:
    from shared.db import query_gsi
    from shared.response import ok, preflight, server_error
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
    from db import query_gsi
    from response import ok, preflight, server_error

# CloudFront edge location prefix → approximate country ISO2 + coords.
# Covers the most common edge codes. Unknown codes fall back to IP lookup.
EDGE_COUNTRY_MAP = {
    "SYD": ("AU", "Australia", -33.9, 151.2),
    "MEL": ("AU", "Australia", -37.8, 145.0),
    "PER": ("AU", "Australia", -31.9, 115.9),
    "BNE": ("AU", "Australia", -27.5, 153.0),
    "AKL": ("NZ", "New Zealand", -36.9, 174.8),
    "NRT": ("JP", "Japan", 35.7, 139.7),
    "ICN": ("KR", "South Korea", 37.5, 126.9),
    "SIN": ("SG", "Singapore", 1.3, 103.8),
    "BOM": ("IN", "India", 19.1, 72.9),
    "HKG": ("HK", "Hong Kong", 22.3, 114.2),
    "LHR": ("GB", "United Kingdom", 51.5, -0.1),
    "AMS": ("NL", "Netherlands", 52.4, 4.9),
    "FRA": ("DE", "Germany", 50.0, 8.6),
    "CDG": ("FR", "France", 48.9, 2.5),
    "MAD": ("ES", "Spain", 40.5, -3.6),
    "MXP": ("IT", "Italy", 45.4, 9.3),
    "ARN": ("SE", "Sweden", 59.6, 17.9),
    "IAD": ("US", "United States", 38.9, -77.5),
    "JFK": ("US", "United States", 40.6, -73.8),
    "LAX": ("US", "United States", 33.9, -118.4),
    "ORD": ("US", "United States", 41.9, -87.9),
    "DFW": ("US", "United States", 32.9, -97.0),
    "MIA": ("US", "United States", 25.8, -80.3),
    "SEA": ("US", "United States", 47.4, -122.3),
    "YYZ": ("CA", "Canada", 43.7, -79.6),
    "YVR": ("CA", "Canada", 49.2, -123.2),
    "GRU": ("BR", "Brazil", -23.4, -46.5),
    "BOG": ("CO", "Colombia", 4.7, -74.1),
    "SCL": ("CL", "Chile", -33.4, -70.8),
    "JNB": ("ZA", "South Africa", -26.1, 28.2),
    "DXB": ("AE", "UAE", 25.3, 55.4),
    "BAH": ("BH", "Bahrain", 26.3, 50.6),
}

_ip_cache: dict[str, tuple] = {}


def _lookup_ip(ip: str) -> tuple:
    if ip in _ip_cache:
        return _ip_cache[ip]
    try:
        with urllib.request.urlopen(f"https://ipapi.co/{ip}/json/", timeout=2) as r:
            data = json.loads(r.read())
        result = (
            data.get("country_code", "XX"),
            data.get("country_name", "Unknown"),
            float(data.get("latitude", 0)),
            float(data.get("longitude", 0)),
        )
    except Exception:
        result = ("XX", "Unknown", 0.0, 0.0)
    _ip_cache[ip] = result
    return result


def _resolve_location(edge_location: str, client_ip: str) -> tuple:
    prefix = edge_location[:3].upper() if edge_location else ""
    if prefix in EDGE_COUNTRY_MAP:
        return EDGE_COUNTRY_MAP[prefix]
    if client_ip and client_ip not in ("-", ""):
        return _lookup_ip(client_ip)
    return ("XX", "Unknown", 0.0, 0.0)


def _parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.rstrip("Z")).replace(tzinfo=timezone.utc)


def lambda_handler(event, context):
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return preflight()

    try:
        params = event.get("queryStringParameters") or {}
        distribution_id = params.get("distributionId", "all")
        now = datetime.now(timezone.utc)
        from_dt = _parse_ts(params["from"]) if params.get("from") else now - timedelta(hours=24)
        to_dt = _parse_ts(params["to"]) if params.get("to") else now
        from_str = from_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        to_str = to_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        if distribution_id == "all":
            dates = set()
            cursor = from_dt.date()
            while cursor <= to_dt.date():
                dates.add(str(cursor))
                cursor = (datetime.combine(cursor, datetime.min.time(), timezone.utc) + timedelta(days=1)).date()
            raw = []
            for d in dates:
                raw.extend(query_gsi("GSI2", "GSI2PK", f"DATE#{d}"))
            items = [i for i in raw if from_str <= i.get("timestamp", "") <= to_str]
        else:
            items = query_gsi(
                "GSI1", "GSI1PK", f"DIST#{distribution_id}",
                sk_name="GSI1SK", sk_between=(from_str, to_str),
            )

        country_counts: dict[str, dict] = defaultdict(lambda: {"count": 0})
        for item in items:
            code, name, lat, lon = _resolve_location(
                item.get("edgeLocation", ""), item.get("clientIp", "")
            )
            key = code
            country_counts[key]["count"] += 1
            country_counts[key].update({"country": code, "countryName": name, "lat": lat, "lon": lon})

        countries = sorted(country_counts.values(), key=lambda x: x["count"], reverse=True)
        return ok({"countries": countries})

    except Exception as e:
        return server_error(str(e))
