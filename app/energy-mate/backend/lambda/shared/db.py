import os
import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get("TABLE_NAME", "em_energy_mate_prod")

_resource = boto3.resource("dynamodb")
_table = None


def table():
    global _table
    if _table is None:
        _table = _resource.Table(TABLE_NAME)
    return _table


def get_item(pk: str, sk: str) -> dict | None:
    resp = table().get_item(Key={"PK": pk, "SK": sk})
    return resp.get("Item")


def put_item(item: dict):
    table().put_item(Item=item)


def query_pk_between(pk: str, sk_start: str, sk_end: str, scan_forward: bool = True) -> list[dict]:
    items = []
    kwargs = {
        "KeyConditionExpression": Key("PK").eq(pk) & Key("SK").between(sk_start, sk_end),
        "ScanIndexForward": scan_forward,
    }
    while True:
        resp = table().query(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items
