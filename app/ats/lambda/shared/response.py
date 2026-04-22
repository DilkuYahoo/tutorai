import json
from decimal import Decimal


class _Encoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return int(o) if o == o.to_integral_value() else float(o)
        return super().default(o)


def _cors(status, body, methods="GET,POST,PUT,DELETE,OPTIONS"):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": methods,
        },
        "body": body if isinstance(body, str) else json.dumps(body, cls=_Encoder),
    }


def ok(body):
    return _cors(200, body)


def created(body):
    return _cors(201, body)


def no_content():
    return _cors(204, "")


def bad_request(message):
    return _cors(400, {"error": message})


def forbidden(message="Forbidden"):
    return _cors(403, {"error": message})


def not_found(message="Not found"):
    return _cors(404, {"error": message})


def conflict(message):
    return _cors(409, {"error": message})


def server_error(message="Internal server error"):
    return _cors(500, {"error": message})


def preflight(methods="GET,POST,PUT,DELETE,OPTIONS"):
    return no_content()
