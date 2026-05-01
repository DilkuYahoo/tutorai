import os
import boto3
import requests

_ssm = None

def _param(name: str) -> str:
    global _ssm
    if _ssm is None:
        _ssm = boto3.client("ssm", region_name="ap-southeast-2")
    resp = _ssm.get_parameter(Name=name, WithDecryption=True)
    return resp["Parameter"]["Value"]


def _creds() -> tuple[str, str]:
    api_key = os.environ.get("LV_API_KEY") or _param("/energy-mate/lv-api-key")
    partner_id = os.environ.get("LV_PARTNER_ID") or _param("/energy-mate/lv-partner-id")
    return api_key, partner_id


def fetch_intervals(nmi: str, from_ts: str, to_ts: str) -> list[dict]:
    """Fetch Localvolts customer interval data for a given NMI and time window."""
    api_key, partner_id = _creds()
    url = "https://api.localvolts.com/v1/customer/interval"
    params = {"NMI": nmi, "from": from_ts, "to": to_ts}
    headers = {
        "Authorization": f"apikey {api_key}",
        "partner": partner_id,
    }
    resp = requests.get(url, params=params, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()
