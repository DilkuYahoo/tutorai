# Ratescan — Skills & Capabilities

A reference guide covering the technical skills, domain knowledge, and architectural patterns required to work effectively on this project.

---

## Domain Knowledge

### Australian Open Banking (Consumer Data Standards)
- CDS API structure — paginated product listings, per-product detail endpoints
- API versioning headers (`x-v`, `x-min-v`) required by all CDS-compliant endpoints
- Product categories and lending rate types returned by Australian bank APIs
- Major bank CDS endpoints: CBA, ANZ, ING, NAB, Westpac

### Financial Product Data
- Lending rate structures — nested tiers, conditions, and applicability rules
- Product metadata: `productId`, `productCategory`, `brand`, `lendingRates`, `applicationUri`
- Date-partitioned product snapshots for historical rate tracking

---

## Data Engineering Skills

### Data Ingestion
- Paginated REST API consumption using `links.next` cursor pattern
- Per-bank configuration via `config.json` — base URLs and request headers
- Incremental fetching — product list first, then per-product detail calls
- Error isolation — individual product/bank failures logged to `api_errors.log` without stopping the pipeline

### Data Transformation
- Recursive JSON flattening with dot-notation for nested keys (`flatten_dict`)
- List-of-dicts expansion with positional indexing (e.g. `lendingRates.0.rate`)
- CSV construction with dynamic fieldnames derived from the union of all flattened keys
- Top-level field ordering preserved in output CSV (`productId`, `name`, `brand`, etc.)

### Data Storage
- **Apache Iceberg** — open table format for large-scale analytical datasets
- **PyIceberg** — Python client for creating namespaces, tables, and appending data
- **PyArrow** — schema inference from pandas DataFrames; columnar data interchange
- Upsert pattern: delete-then-append keyed on `(productId, productCategory, rate)`
- Auto-create namespace and table if they do not exist

### File System Conventions
- Output layout: `products/{bank}/products.json` → `products/{bank}/details/{YYYY-MM-DD}/{productId}.json`
- Latest-date resolution — pipeline picks the most recent dated folder automatically
- Date-stamped CSV output: `product-master-{YYYY-MM-DD}.csv`

---

## AWS Skills

| Service | Usage |
|---------|-------|
| **S3** | Iceberg warehouse storage (`s3://ratescan.com.au/iceberg/`) |
| **Glue** | Iceberg catalog (`OBDB` database, `daily_rates` table) |

- AWS credentials must be available in the environment (IAM role, `~/.aws/credentials`, or env vars)
- Region: `ap-southeast-2` (Sydney)
- Glue catalog loaded via `pyiceberg.catalog.load_catalog("glue", type="glue", ...)`

---

## Python Skills

### Libraries
- **`requests`** — HTTP client for Open Banking API calls with header injection
- **`pandas`** — CSV loading, DataFrame manipulation, primary key deduplication
- **`pyarrow`** — schema inference and columnar table construction for Iceberg writes
- **`pyiceberg`** — Iceberg catalog operations, table creation, delete/append upsert

### Patterns
- Config-driven design — all bank-specific values externalised to `config.json`
- `logging` module with `INFO`-level structured output to stdout
- `os.makedirs(..., exist_ok=True)` for safe directory creation
- `sys.argv` for optional CLI config file override with sensible defaults

---

## Architecture Patterns

### Pipeline Design
- **Sequential four-stage pipeline** — each script is independently runnable and idempotent within its stage
- **File-based handoff** — stages communicate via the local `products/` directory and dated CSV files, not in-memory state
- **Fault isolation** — per-bank and per-product try/except blocks with structured error logging prevent partial failures from halting the full run
- **Date partitioning** — detail files are written to dated subdirectories, preserving historical snapshots

### Data Flow
```
config.json
    ↓
main.py  →  products/{bank}/products.json
    ↓
main_prod_details.py  →  products/{bank}/details/{date}/{productId}.json
    ↓
flatten_json_to_csv.py  →  product-master-{date}.csv
    ↓
upsert_dataset.py  →  S3 Iceberg (OBDB.daily_rates)
```

---

## Key Files to Know

| Path | Purpose |
|------|---------|
| [main.py](main.py) | Stage 1 — fetch paginated product list per bank |
| [main_prod_details.py](main_prod_details.py) | Stage 2 — fetch full product details per product ID |
| [flatten_json_to_csv.py](flatten_json_to_csv.py) | Stage 3 — flatten nested JSON lending rates to CSV |
| [upsert_dataset.py](upsert_dataset.py) | Stage 4 — upsert CSV into Iceberg via AWS Glue |
| [config.json](config.json) | Bank API endpoints and request headers |
