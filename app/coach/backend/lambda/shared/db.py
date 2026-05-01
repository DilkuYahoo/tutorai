import os
import boto3
from boto3.dynamodb.conditions import Key, Attr

TABLE_NAME = os.environ.get("TABLE_NAME", "pg_playgenie_prod")

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


def delete_item(pk: str, sk: str):
    table().delete_item(Key={"PK": pk, "SK": sk})


def update_item(pk: str, sk: str, updates: dict) -> dict:
    if not updates:
        return {}
    expr_parts = []
    expr_names = {}
    expr_values = {}
    for i, (key, val) in enumerate(updates.items()):
        pn = f"#k{i}"
        pv = f":v{i}"
        expr_parts.append(f"{pn} = {pv}")
        expr_names[pn] = key
        expr_values[pv] = val
    resp = table().update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
        ReturnValues="ALL_NEW",
    )
    return resp.get("Attributes", {})


def increment(pk: str, sk: str, field: str, amount: int = 1):
    table().update_item(
        Key={"PK": pk, "SK": sk},
        UpdateExpression="ADD #f :amt",
        ExpressionAttributeNames={"#f": field},
        ExpressionAttributeValues={":amt": amount},
    )


def query_pk(
    pk: str,
    sk_prefix: str | None = None,
    limit: int | None = None,
    scan_forward: bool = True,
    filter_expr=None,
) -> list[dict]:
    kwargs = {
        "KeyConditionExpression": Key("PK").eq(pk),
        "ScanIndexForward": scan_forward,
    }
    if sk_prefix:
        kwargs["KeyConditionExpression"] &= Key("SK").begins_with(sk_prefix)
    if limit:
        kwargs["Limit"] = limit
    if filter_expr is not None:
        kwargs["FilterExpression"] = filter_expr
    resp = table().query(**kwargs)
    return resp.get("Items", [])


def query_pk_between(pk: str, sk_start: str, sk_end: str, scan_forward: bool = True) -> list[dict]:
    resp = table().query(
        KeyConditionExpression=Key("PK").eq(pk) & Key("SK").between(sk_start, sk_end),
        ScanIndexForward=scan_forward,
    )
    return resp.get("Items", [])


def query_gsi(
    index: str,
    pk_name: str,
    pk_value: str,
    sk_name: str | None = None,
    sk_prefix: str | None = None,
    sk_between: tuple | None = None,
    limit: int | None = None,
    scan_forward: bool = True,
    filter_expr=None,
) -> list[dict]:
    key_cond = Key(pk_name).eq(pk_value)
    if sk_name and sk_prefix:
        key_cond &= Key(sk_name).begins_with(sk_prefix)
    elif sk_name and sk_between:
        key_cond &= Key(sk_name).between(sk_between[0], sk_between[1])
    kwargs = {
        "IndexName": index,
        "KeyConditionExpression": key_cond,
        "ScanIndexForward": scan_forward,
    }
    if limit:
        kwargs["Limit"] = limit
    if filter_expr is not None:
        kwargs["FilterExpression"] = filter_expr
    resp = table().query(**kwargs)
    return resp.get("Items", [])


def batch_get(keys: list[dict]) -> list[dict]:
    if not keys:
        return []
    dynamodb = boto3.resource("dynamodb")
    resp = dynamodb.batch_get_item(RequestItems={TABLE_NAME: {"Keys": keys}})
    return resp.get("Responses", {}).get(TABLE_NAME, [])


def transact_write(operations: list[dict]):
    client = boto3.client("dynamodb")
    serialiser = boto3.dynamodb.types.TypeSerializer()
    _SERIALISE_KEYS = {"Item", "Key", "ExpressionAttributeValues"}
    low_level_ops = []
    for op in operations:
        low_level_op = {}
        for op_type, op_body in op.items():
            low_level_body = {k: v for k, v in op_body.items() if k not in _SERIALISE_KEYS}
            for field in _SERIALISE_KEYS:
                if field in op_body:
                    low_level_body[field] = {k: serialiser.serialize(v) for k, v in op_body[field].items()}
            low_level_body["TableName"] = TABLE_NAME
            low_level_op[op_type] = low_level_body
        low_level_ops.append(low_level_op)
    client.transact_write_items(TransactItems=low_level_ops)
