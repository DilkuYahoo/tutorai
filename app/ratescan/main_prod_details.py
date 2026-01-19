import logging
import sys
import requests
import json
import os
import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stdout)

def load_config(config_file):
    with open(config_file, "r") as f:
        return json.load(f)

def fetch_product_details(config):
    logging.info("Starting to fetch product details")
    for bank, bank_config in config["banks"].items():
        logging.info(f"Processing bank: {bank}")
        try:
            with open(f"products/{bank}/products.json", "r") as f:
                products = json.load(f)
        except FileNotFoundError:
            logging.warning(f"Products file for {bank} not found.")
            continue

        product_ids = [product["productId"] for product in products]
        logging.info(f"Found {len(product_ids)} products for {bank}")

        base_url = bank_config["base_url"]
        headers = bank_config["headers_prd_details"]

        date_str = datetime.datetime.now().strftime("%Y-%m-%d")
        os.makedirs(f"products/{bank}/details/{date_str}", exist_ok=True)

        for product_id in product_ids:
            try:
                url = base_url + "/" + product_id
                logging.info(f"Fetching details for product {product_id} from {bank}")
                response = requests.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()

                with open(f"products/{bank}/details/{date_str}/{product_id}.json", "w") as f:
                    json.dump(data, f, indent=4)
                logging.info(f"Saved details for {product_id} from {bank}")
            except Exception as e:
                logging.error(f"Error for product {product_id} from {bank}: {str(e)}")
                with open("api_errors.log", "a") as f:
                    f.write(f"Error for product {product_id} from {bank}: {str(e)}\n")

def main(config_file="config.json"):
    config = load_config(config_file)
    fetch_product_details(config)

if __name__ == "__main__":
    import sys
    config_file = sys.argv[1] if len(sys.argv) > 1 else "config.json"
    main(config_file)