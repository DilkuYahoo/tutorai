#!/usr/bin/env python3
"""
Test CDR Open Banking API endpoints with different header combinations
to identify which version/header set gets responses from failing banks.
Uses only Python stdlib (urllib) — no external dependencies.
"""

import urllib.request
import urllib.error
import json
import sys
from urllib.parse import urlparse

# Configure targets - the 12 failing URLs from Stage 1
TARGETS = [
    {"bank": "AFG_Home_Loans_Alpha", "url": "https://api.afg.app.bendigobank.com.au/cds-au/v1/banking/products"},
    {"bank": "Aussie_Elevate", "url": "https://api.aussie.app.bendigobank.com.au/cds-au/v1/banking/products"},
    {"bank": "Aussie_Home_Loans", "url": "https://aussie.openportal.com.au/cds-au/v1/banking/products"},
    {"bank": "Connective_Select", "url": "https://api.connective.app.bendigobank.com.au/cds-au/v1/banking/products"},
    {"bank": "NRMA_Home_Loans", "url": "https://api.nrma.app.bendigobank.com.au/cds-au/v1/banking/products"},
    {"bank": "Qantas_Money_Home_Loans", "url": "https://api.qantas.app.bendigobank.com.au/cds-au/v1/banking/products"},
    {"bank": "Rabobank", "url": "https://openbanking.api.rabobank.com.au/public/cds-au/v1/banking/products"},
    {"bank": "Tiimely_Home", "url": "https://api.tiimely.app.bendigobank.com.au/cds-au/v1/banking/products"},
    {"bank": "People's_Choice_and_Heritage", "url": "https://ob-public.peopleschoice.com.au/cds-au/v1/banking/products"},
    {"bank": "AMP_-_My_AMP", "url": "https://api.cdr-api.amp.com.au/cds-au/v1/banking/products"},
    {"bank": "in1bank_ltd.", "url": "https://cdr.in1bank.com.au/cds-au/v1/banking/products"},
    {"bank": "St.George_Bank", "url": "https://digital-api.stgeorge.com.au/cds-au/v1/banking/products?page=2&page-size=25"},
]

# Different header combinations to test
HEADER_VARIANTS = [
    {
        "name": "Fixed Config (v4 + UA)",
        "headers": {
            "Accept": "application/json",
            "x-v": "4",
            "x-min-v": "3",
            "User-Agent": "Mozilla/5.0 (compatible; RateScan/1.0)"
        }
    },
    {
        "name": "CDR v5 (min v5)",
        "headers": {
            "Accept": "application/json",
            "x-v": "5",
            "x-min-v": "5",
        }
    },
    {
        "name": "CDR v3 (min v2)",
        "headers": {
            "Accept": "application/json",
            "x-v": "3",
            "x-min-v": "2",
        }
    },
    {
        "name": "No version headers",
        "headers": {
            "Accept": "application/json",
        }
    },
    {
        "name": "CDR v5 + UA",
        "headers": {
            "Accept": "application/json",
            "x-v": "5",
            "x-min-v": "5",
            "User-Agent": "Mozilla/5.0 (compatible; RateScan/1.0)",
        }
    },
    {
        "name": "No-UA (old config)",
        "headers": {
            "Accept": "application/json",
            "x-v": "4",
            "x-min-v": "3",
        }
    },
    {
        "name": "No-UA v5 (old config)",
        "headers": {
            "Accept": "application/json",
            "x-v": "5",
            "x-min-v": "3",
        }
    },
]

TIMEOUT = 10  # seconds


def test_endpoint(bank, url):
    """Test a URL with different header combinations."""
    print(f"\n{'='*90}")
    print(f"Bank: {bank}")
    print(f"URL: {url}")
    print(f"{'='*90}")

    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    query = parsed.query

    for variant in HEADER_VARIANTS:
        headers = variant["headers"].copy()
        full_url = url if not query else f"{base_url}?{query}"

        req = urllib.request.Request(full_url, headers=headers, method="GET")

        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                status = resp.getcode()
                content_type = resp.headers.get('Content-Type', 'N/A')
                body = resp.read().decode('utf-8', errors='replace')
                body_preview = body[:200] if body else ''

                # Color coding
                if 200 <= status < 300:
                    status_str = f"\033[92m✓ {status} OK\033[0m"
                elif status == 403:
                    status_str = f"\033[93m✗ {status} Forbidden\033[0m"
                elif status == 404:
                    status_str = f"\033[91m✗ {status} Not Found\033[0m"
                elif status == 500:
                    status_str = f"\033[91m✗ {status} Server Error\033[0m"
                else:
                    status_str = f"? {status}"

                print(f"{variant['name']:<25} {status_str}  Content-Type: {content_type}  Len: {len(body)}")
                if body_preview:
                    print(f"  Preview: {body_preview[:120]}")

        except urllib.error.HTTPError as e:
            status = e.code
            body = e.read().decode('utf-8', errors='replace') if e.fp else ''
            body_preview = body[:200] if body else ''
            content_type = e.headers.get('Content-Type', 'N/A') if e.headers else 'N/A'

            if status == 403:
                status_str = f"\033[93m✗ {status} Forbidden\033[0m"
            elif status == 404:
                status_str = f"\033[91m✗ {status} Not Found\033[0m"
            elif status == 500:
                status_str = f"\033[91m✗ {status} Server Error\033[0m"
            else:
                status_str = f"✗ {status}"

            print(f"{variant['name']:<25} {status_str}  Content-Type: {content_type}  Len: {len(body)}")
            if body_preview:
                print(f"  Preview: {body_preview[:120]}")

        except urllib.error.URLError as e:
            print(f"{variant['name']:<25} \033[91m✗ URL ERROR: {str(e)}\033[0m")
        except Exception as e:
            print(f"{variant['name']:<25} \033[91m✗ ERROR: {str(e)[:60]}\033[0m")


def main():
    print("="*90)
    print("CDR API ENDPOINT TESTER — Version/Header Combinations")
    print("="*90)
    print(f"Testing {len(TARGETS)} banks × {len(HEADER_VARIANTS)} header variants")
    print("Looking for any 200/2xx responses or useful non-403 patterns")
    print("\033[92m✓ 200 OK\033[0m  \033[93m✗ 403 Forbidden\033[0m  \033[91m✗ 404/500/Error\033[0m")

    if len(sys.argv) > 1:
        bank_name = sys.argv[1]
        targets = [t for t in TARGETS if t["bank"] == bank_name]
        if not targets:
            print(f"Bank '{bank_name}' not found. Available: {', '.join(t['bank'] for t in TARGETS)}")
            return
    else:
        targets = TARGETS

    for target in targets:
        test_endpoint(target["bank"], target["url"])

    print("\n\n" + "="*90)
    print("SUMMARY")
    print("="*90)
    print("If any variant returns 200, record which headers worked.")
    print("If all return 403, APIs likely require CDR certificates / JWT auth.")
    print("If all return 404, endpoints may be deprecated URLs.")


if __name__ == "__main__":
    main()
