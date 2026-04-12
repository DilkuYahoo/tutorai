# Ratescan

A data pipeline that collects Australian banking product data from the [Consumer Data Standards (CDS) Open Banking API](https://consumerdatastandards.gov.au/), flattens it into a structured dataset, and upserts it into an Apache Iceberg table on AWS.

## Overview

The pipeline runs in four sequential steps:

```
1. Fetch product list  →  2. Fetch product details  →  3. Flatten to CSV  →  4. Upsert to Iceberg
     main.py               main_prod_details.py       flatten_json_to_csv.py   upsert_dataset.py
```

## Supported Banks

| Bank    | API Base URL |
|---------|-------------|
| CBA     | `https://api.commbank.com.au/public/cds-au/v1/banking/products` |
| ANZ     | `https://api.anz/cds-au/v1/banking/products` |
| ING     | `https://id.ob.ing.com.au/cds-au/v1/banking/products` |
| NAB     | `https://openbank.api.nab.com.au/cds-au/v1/banking/products` |
| Westpac | `https://digital-api.westpac.com.au/cds-au/v1/banking/products` |

## Scripts

### `main.py` — Fetch Product List

Fetches the full product catalogue for each bank (handles pagination) and saves results to `products/{bank}/products.json`.

```bash
python main.py [config.json]
```

### `main_prod_details.py` — Fetch Product Details

Reads the product IDs collected in step 1 and fetches full details for each product. Saves individual JSON files to `products/{bank}/details/{YYYY-MM-DD}/{productId}.json`.

```bash
python main_prod_details.py [config.json]
```

### `flatten_json_to_csv.py` — Flatten to CSV

Reads the latest dated detail files for each bank, extracts lending rates, and flattens the nested JSON structure into a flat CSV using dot-notation for nested keys.

Output: `product-master-{YYYY-MM-DD}.csv`

```bash
python flatten_json_to_csv.py
```

### `upsert_dataset.py` — Upsert to Iceberg

Loads the CSV into a pandas DataFrame and upserts it into an Apache Iceberg table (`OBDB.daily_rates`) stored in S3, using AWS Glue as the catalog. The upsert key is `(productId, productCategory, rate)`.

Creates the namespace and table automatically if they do not exist.

```bash
python upsert_dataset.py
```

## Configuration

Banks and their API endpoints are defined in `config.json`:

```json
{
  "banks": {
    "CBA": {
      "base_url": "https://api.commbank.com.au/public/cds-au/v1/banking/products",
      "headers_prd_details": {
        "Accept": "application/json",
        "x-v": "5",
        "x-min-v": "3"
      }
    }
  }
}
```

Add or remove banks by editing this file. Alternative config files (`config-test.json`, `config-fix.json`) can be passed as a command-line argument to the fetch scripts.

## Output Structure

```
products/
  {bank}/
    products.json                  # Full product list
    details/
      {YYYY-MM-DD}/
        {productId}.json           # Individual product detail
product-master-{YYYY-MM-DD}.csv    # Flattened lending rates
api_errors.log                     # Errors from API fetches
```

## AWS Infrastructure

| Setting   | Value |
|-----------|-------|
| Region    | `ap-southeast-2` |
| Warehouse | `s3://ratescan.com.au/iceberg/` |
| Catalog   | AWS Glue (`OBDB`) |
| Table     | `daily_rates` |

Ensure your environment has AWS credentials configured with read/write access to the S3 bucket and Glue catalog.

## Dependencies

```
requests
pandas
pyarrow
pyiceberg[glue]
```

Install with:

```bash
pip install requests pandas pyarrow "pyiceberg[glue]"
```
