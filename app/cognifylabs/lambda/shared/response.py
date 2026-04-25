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
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": body if isinstance(body, str) else json.dumps(body, cls=_Encoder),
    }


def ok(body):
    return _cors(200, body)


def bad_request(message):
    return _cors(400, {"error": message})


def not_found(message="Not found"):
    return _cors(404, {"error": message})


def server_error(message="Internal server error"):
    return _cors(500, {"error": message})


def preflight():
    return {
        "statusCode": 204,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": "",
    }
