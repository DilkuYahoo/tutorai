"""
athena_helper.py — reusable Athena query runner.

Usage in any Lambda:
    from athena_helper import run_query
    rows = run_query("SELECT ... FROM obdb.daily_rates ...")
    # rows is a list[dict] with column names as keys, all values as str|None

Configuration (via environment variables — set in iac/template.yaml Globals):
    ATHENA_WORKGROUP      Athena workgroup name          (default: primary)
    ATHENA_RESULTS_BUCKET S3 bucket for query results    (required)
    ATHENA_RESULTS_PREFIX S3 key prefix for results      (default: athena-results)
    ATHENA_DATABASE       Glue database to query against (default: obdb)
"""

import os
import time
import boto3

_athena = boto3.client("athena")

WORKGROUP      = os.environ.get("ATHENA_WORKGROUP", "primary")
RESULTS_BUCKET = os.environ.get("ATHENA_RESULTS_BUCKET", "ratescan.com.au")
RESULTS_PREFIX = os.environ.get("ATHENA_RESULTS_PREFIX", "athena-results")
DATABASE       = os.environ.get("ATHENA_DATABASE", "obdb")


def run_query(sql: str, *, max_wait: int = 55) -> list:
    """
    Submit *sql* to Athena, poll until complete, and return results as a
    list of dicts (one dict per data row, column name → string value).

    Raises:
        RuntimeError  — query FAILED or CANCELLED (message includes Athena reason)
        TimeoutError  — query did not finish within *max_wait* seconds
    """
    execution_id = _start(sql)
    _wait(execution_id, max_wait)
    return _fetch(execution_id)


# ── internal helpers ──────────────────────────────────────────────────────────

def _start(sql: str) -> str:
    resp = _athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": DATABASE},
        ResultConfiguration={
            "OutputLocation": f"s3://{RESULTS_BUCKET}/{RESULTS_PREFIX}/",
        },
        WorkGroup=WORKGROUP,
    )
    return resp["QueryExecutionId"]


def _wait(execution_id: str, max_wait: int) -> None:
    interval = 0.5
    deadline = time.monotonic() + max_wait

    while time.monotonic() < deadline:
        resp  = _athena.get_query_execution(QueryExecutionId=execution_id)
        state = resp["QueryExecution"]["Status"]["State"]

        if state == "SUCCEEDED":
            return
        if state in ("FAILED", "CANCELLED"):
            reason = resp["QueryExecution"]["Status"].get("StateChangeReason", "no reason given")
            raise RuntimeError(f"Athena query {state}: {reason}")

        time.sleep(interval)
        interval = min(interval * 1.5, 5.0)   # exponential back-off, capped at 5 s

    raise TimeoutError(f"Athena query {execution_id} did not finish within {max_wait}s")


def _fetch(execution_id: str) -> list:
    paginator = _athena.get_paginator("get_query_results")
    columns: list | None = None
    rows: list = []

    for page in paginator.paginate(QueryExecutionId=execution_id):
        result_set = page["ResultSet"]

        # Column metadata is in the first page only
        if columns is None:
            columns = [
                col["Label"]
                for col in result_set["ResultSetMetadata"]["ColumnInfo"]
            ]

        for i, row in enumerate(result_set["Rows"]):
            # The very first row of the first page is the header — skip it
            if i == 0 and columns is not None and _is_header(row, columns):
                continue
            values = [d.get("VarCharValue") for d in row["Data"]]
            rows.append(dict(zip(columns, values)))

    return rows


def _is_header(row: dict, columns: list) -> bool:
    """Return True if *row* contains the column name literals (Athena header row)."""
    values = [d.get("VarCharValue", "") for d in row["Data"]]
    return values == columns
