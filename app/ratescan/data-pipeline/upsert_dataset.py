import logging
import sys
import os
import io
import datetime
import traceback
import pandas as pd
import pyarrow as pa
import boto3
from zoneinfo import ZoneInfo
from botocore.exceptions import BotoCoreError, ClientError
from pyiceberg.catalog import load_catalog
from pyiceberg.exceptions import NoSuchTableError, NoSuchNamespaceError
from pyiceberg.io.pyarrow import pyarrow_to_schema, schema_to_pyarrow

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# AWS / Iceberg configuration — override via environment variables
AWS_REGION       = os.environ.get("AWS_REGION",       "ap-southeast-2")
WAREHOUSE        = os.environ.get("WAREHOUSE",        "s3://ratescan.com.au/iceberg/")
S3_BUCKET        = os.environ.get("S3_BUCKET",        "ratescan.com.au")
ICEBERG_CATALOG  = os.environ.get("ICEBERG_CATALOG",  "OpenBanking")
DB               = os.environ.get("ICEBERG_DB",       "obdb")
TABLE            = os.environ.get("ICEBERG_TABLE",    "daily_rates")


def _default_csv_key():
    date_str = datetime.datetime.now(ZoneInfo("Australia/Sydney")).strftime("%Y-%m-%d")
    return f"product-master-{date_str}.csv"


def load_dataframe_from_s3(s3_client, bucket, key):
    logger.info(f"Reading CSV from s3://{bucket}/{key}")
    response = s3_client.get_object(Bucket=bucket, Key=key)
    return pd.read_csv(io.BytesIO(response["Body"].read()))


def load_dataframe_from_local(path):
    logger.info(f"Reading CSV from local path: {path}")
    return pd.read_csv(path)


def get_or_create_glue_catalog():
    return load_catalog(
        ICEBERG_CATALOG,
        type="glue",
        warehouse=WAREHOUSE,
        region=AWS_REGION,
    )


def get_or_create_local_catalog(warehouse_path="/tmp/iceberg"):
    """SQLite-backed catalog for local testing — no AWS required."""
    os.makedirs(warehouse_path, exist_ok=True)
    db_path = os.path.join(warehouse_path, "catalog.db")
    return load_catalog(
        "local",
        type="sql",
        uri=f"sqlite:///{db_path}",
        warehouse=f"file://{warehouse_path}",
    )


def ensure_namespace(catalog):
    try:
        catalog.load_namespace_properties(DB)
        logger.info(f"Namespace {DB} exists")
    except NoSuchNamespaceError:
        catalog.create_namespace(DB)
        logger.info(f"Created namespace {DB}")


def _infer_iceberg_schema(arrow_schema: pa.Schema):
    """
    Convert a plain Arrow schema (from pa.Table.from_pandas, no field IDs) to a
    PyIceberg Schema. PyIceberg 0.8+ requires PARQUET:field_id metadata on each
    Arrow field before calling pyarrow_to_schema; this helper adds sequential IDs.
    Only needed for flat/primitive schemas — which is all we have after CSV flattening.
    """
    annotated = pa.schema([
        field.with_metadata({"PARQUET:field_id": str(i + 1)})
        for i, field in enumerate(arrow_schema)
    ])
    return pyarrow_to_schema(annotated)


def upsert(df, catalog):
    ensure_namespace(catalog)

    arrow_table = pa.Table.from_pandas(df, preserve_index=False)
    incoming_schema = _infer_iceberg_schema(arrow_table.schema)

    try:
        table = catalog.load_table(f"{DB}.{TABLE}")
        logger.info(f"Table {DB}.{TABLE} exists")
        # Evolve the Iceberg schema to include any new columns in today's CSV.
        # Bank APIs occasionally add new fields (e.g. new tier attributes).
        # Rows from prior snapshots will have NULL for any new columns.
        with table.update_schema() as update:
            update.union_by_name(incoming_schema)
        table = catalog.load_table(f"{DB}.{TABLE}")
    except NoSuchTableError:
        table = catalog.create_table(identifier=f"{DB}.{TABLE}", schema=incoming_schema)
        logger.info(f"Created table {DB}.{TABLE}")

    # Rebuild the Arrow table using Iceberg's own Arrow schema so that the written
    # Parquet files contain Iceberg field IDs in their metadata. Without this,
    # PyIceberg cannot map Parquet columns back to Iceberg fields.
    # Columns in the Iceberg schema absent from today's CSV are filled with nulls.
    iceberg_arrow_schema = schema_to_pyarrow(table.schema())
    df_cols = set(df.columns)
    columns = {}
    for field in iceberg_arrow_schema:
        if field.name in df_cols:
            columns[field.name] = arrow_table.column(field.name).cast(field.type, safe=False)
        else:
            columns[field.name] = pa.array([None] * len(df), type=field.type)

    arrow_table_for_write = pa.table(columns, schema=iceberg_arrow_schema)
    table.overwrite(arrow_table_for_write)
    logger.info(f"Overwrote {len(df)} rows into {DB}.{TABLE}")


def lambda_handler(event, context):
    """
    Lambda entry point.

    Event schema (all fields optional):
      {
        "csv_key": "product-master-2026-04-12.csv"  // defaults to today's date
      }
    """
    csv_key = (event or {}).get("csv_key") or _default_csv_key()

    try:
        s3_client = boto3.client("s3", region_name=AWS_REGION)
        df = load_dataframe_from_s3(s3_client, S3_BUCKET, csv_key)
        logger.info(f"Loaded {len(df)} rows from CSV")

        catalog = get_or_create_glue_catalog()
        upsert(df, catalog)

        return {
            "statusCode": 200,
            "body": {
                "message": "Upsert complete",
                "csv_key": csv_key,
                "rows": len(df),
            },
        }
    except (BotoCoreError, ClientError) as e:
        logger.error(f"AWS error: {e}\n{traceback.format_exc()}")
        raise
    except Exception as e:
        logger.error(f"Upsert failed: {e}\n{traceback.format_exc()}")
        raise


if __name__ == "__main__":
    # Usage:
    #   python upsert_dataset.py                              # uses today's date CSV from local dir
    #   python upsert_dataset.py product-master-2026-04-12.csv
    csv_path = sys.argv[1] if len(sys.argv) > 1 else f"product-master-{datetime.datetime.now(ZoneInfo('Australia/Sydney')).strftime('%Y-%m-%d')}.csv"

    df = load_dataframe_from_local(csv_path)
    logger.info(f"Loaded {len(df)} rows")

    catalog = get_or_create_local_catalog()
    upsert(df, catalog)

    logger.info("Local upsert complete")
    logger.info(f"Iceberg catalog written to /tmp/iceberg/")
