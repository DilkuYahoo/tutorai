import json
from decimal import Decimal


class _Encoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return int(o) if o == o.to_integral_value() else float(o)
        return super().default(o)


def _cors(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": body if isinstance(body, str) else json.dumps(body, cls=_Encoder),
    }


def ok(body):
    return _cors(200, body)


def preflight():
    return _cors(204, "")


def server_error(message="Internal server error"):
    return _cors(500, {"error": message})
