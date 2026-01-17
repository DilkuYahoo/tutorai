import json
import csv
import os
import glob
import datetime

# Top-level fields to repeat in order
top_fields = ['productId', 'name', 'brand', 'lastUpdated', 'description', 'applicationUri', 'productCategory']

def flatten_dict(d, prefix=''):
    """
    Recursively flatten a dictionary using dot notation for nested keys.
    For lists, if the list contains dictionaries, flatten all with index.
    Otherwise, convert to string.
    """
    items = []
    for k, v in d.items():
        new_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key).items())
        elif isinstance(v, list):
            if v and isinstance(v[0], dict):
                for i, item in enumerate(v):
                    items.extend(flatten_dict(item, f"{new_key}.{i}").items())
            else:
                items.append((new_key, str(v)))
        else:
            items.append((new_key, v))
    return dict(items)

def process_json_file(json_file_path):
    # Load JSON data
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    product_data = data['data']
    lending_rates = product_data.get('lendingRates', [])
    rows = []
    for rate in lending_rates:
        # Start with top-level fields
        row = {field: product_data.get(field, '') for field in top_fields}
        # Flatten the lending rate and add to row
        flattened_rate = flatten_dict(rate)
        row.update(flattened_rate)
        rows.append(row)
    return rows

def main():
    # Find JSON files in the latest dated folder for each bank
    products_dir = 'products'
    json_files = []
    if os.path.exists(products_dir):
        banks = [d for d in os.listdir(products_dir) if os.path.isdir(os.path.join(products_dir, d))]
        for bank in banks:
            details_dir = os.path.join(products_dir, bank, 'details')
            if os.path.exists(details_dir):
                dates = [d for d in os.listdir(details_dir) if os.path.isdir(os.path.join(details_dir, d))]
                if dates:
                    latest_date = max(dates)  # Assuming dates are in sortable format like YYYY-MM-DD
                    latest_dir = os.path.join(details_dir, latest_date)
                    json_files.extend(glob.glob(os.path.join(latest_dir, '*.json')))

    all_rows = []
    for json_file in json_files:
        try:
            rows = process_json_file(json_file)
            all_rows.extend(rows)
        except Exception as e:
            print(f"Error processing {json_file}: {e}")

    # Output to CSV
    if all_rows:
        # Collect all unique fieldnames
        all_keys = set()
        for row in all_rows:
            all_keys.update(row.keys())
        fieldnames = top_fields + sorted(all_keys - set(top_fields))

        date_str = datetime.date.today().isoformat()
        csv_file_path = f"product-master-{date_str}.csv"
        with open(csv_file_path, 'w', newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_rows)
        print(f"CSV file created: {csv_file_path} with {len(all_rows)} rows")
    else:
        print("No lending rates found.")

if __name__ == "__main__":
    main()