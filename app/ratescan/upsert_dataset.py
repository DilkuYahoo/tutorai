import logging
import sys
import pandas as pd
import pyarrow as pa
from pyiceberg.catalog import load_catalog
from pyiceberg.expressions import And, EqualTo
from pyiceberg.exceptions import NoSuchTableError, NoSuchNamespaceError

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stdout)

AWS_REGION = "ap-southeast-2"
WAREHOUSE = "s3://ratescan.com.au/iceberg/"
DB = "OBDB"
TABLE = "daily_rates"
PRIMARY_KEY = ["productId", "productCategory", "rate"]

def upsert_csv_to_iceberg(csv_file):
    logging.info(f"Starting upsert for {csv_file}")
    df = pd.read_csv(csv_file)
    logging.info(f"Loaded {len(df)} rows from CSV")

    catalog = load_catalog(
        "glue",
        type="glue",
        warehouse=WAREHOUSE,
        region=AWS_REGION
    )
    logging.info("Loaded Glue catalog")

    try:
        catalog.load_namespace_properties(DB)
        logging.info(f"Database {DB} exists")
    except NoSuchNamespaceError:
        catalog.create_namespace(DB)
        logging.info(f"Created database {DB}")

    try:
        table = catalog.load_table(f"{DB}.{TABLE}")
        logging.info(f"Table {DB}.{TABLE} exists")
    except NoSuchTableError:
        schema = pa.Schema.from_pandas(df)
        table = catalog.create_table(identifier=f"{DB}.{TABLE}", schema=schema)
        logging.info(f"Created table {DB}.{TABLE}")

    # Delete existing keys (simple upsert pattern)
    keys = df[PRIMARY_KEY].drop_duplicates().values.tolist()
    keys = [k for k in keys if not any(pd.isna(v) for v in k)]
    logging.info(f"Deleting {len(keys)} existing key combinations")
    for k in keys:
        table.delete(And(*[EqualTo(col, val) for col, val in zip(PRIMARY_KEY, k)]))

    # Append new version
    table.append(pa.Table.from_pandas(df))
    logging.info(f"Appended {len(df)} rows to table")

    logging.info(f"Upserted {len(df)} rows from {csv_file} into Iceberg with new snapshot")

if __name__ == "__main__":
    upsert_csv_to_iceberg("product-master-2026-01-19.csv")
