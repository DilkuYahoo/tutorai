import os
import boto3
from boto3.dynamodb.conditions import Key
from decimal import Decimal

TABLE_NAME = os.environ.get("TABLE_NAME", "platform_monitor")

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


def update_item(pk: str, sk: str, updates: dict) -> dict:
    if not updates:
        return {}
    expr_parts, expr_names, expr_values = [], {}, {}
    for i, (key, val) in enumerate(updates.items()):
        n, v = f"#k{i}", f":v{i}"
        expr_parts.append(f"{n} = {v}")
        expr_names[n] = key
        expr_values[v] = val
    resp = table().update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
        ReturnValues="ALL_NEW",
    )
    return resp.get("Attributes", {})


def query_pk(pk: str, sk_prefix: str | None = None, scan_forward: bool = True) -> list[dict]:
    kwargs = {"KeyConditionExpression": Key("PK").eq(pk), "ScanIndexForward": scan_forward}
    if sk_prefix:
        kwargs["KeyConditionExpression"] &= Key("SK").begins_with(sk_prefix)
    resp = table().query(**kwargs)
    return resp.get("Items", [])


def query_gsi(
    index: str,
    pk_name: str,
    pk_value: str,
    sk_name: str | None = None,
    sk_between: tuple | None = None,
    sk_prefix: str | None = None,
    scan_forward: bool = True,
    filter_expr=None,
) -> list[dict]:
    key_cond = Key(pk_name).eq(pk_value)
    if sk_name and sk_between:
        key_cond &= Key(sk_name).between(*sk_between)
    elif sk_name and sk_prefix:
        key_cond &= Key(sk_name).begins_with(sk_prefix)
    kwargs = {
        "IndexName": index,
        "KeyConditionExpression": key_cond,
        "ScanIndexForward": scan_forward,
    }
    if filter_expr is not None:
        kwargs["FilterExpression"] = filter_expr

    items = []
    while True:
        resp = table().query(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items
