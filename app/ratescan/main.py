import logging
import sys
import requests
import json
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stdout)

def load_config(config_file):
    with open(config_file, "r") as f:
        return json.load(f)

def fetch_openbanking_data(config):
    logging.info("Starting to fetch open banking data")
    for bank, bank_config in config["banks"].items():
        logging.info(f"Processing bank: {bank}")
        try:
            base_url = bank_config["base_url"]
            headers = bank_config["headers_prd_details"]
            all_products = []
            url = base_url

            while url:
                logging.info(f"Fetching from URL: {url}")
                response = requests.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                products = data.get("data", {}).get("products", [])
                all_products.extend(products)
                
                links = data.get("links", {})
                url = links.get("next")
            
            os.makedirs(f"products/{bank}", exist_ok=True)
            with open(f"products/{bank}/products.json", "w") as f:
                json.dump(all_products, f, indent=4)
            logging.info(f"Collected {len(all_products)} products for {bank} and saved to products/{bank}/products.json")
        except Exception as e:
            logging.error(f"Error for bank {bank}: {str(e)}")
            with open("api_errors.log", "a") as f:
                f.write(f"Error for bank {bank}: {str(e)}\n")

def main(config_file="config.json"):
    config = load_config(config_file)
    fetch_openbanking_data(config)

if __name__ == "__main__":
    import sys
    config_file = sys.argv[1] if len(sys.argv) > 1 else "config.json"
    main(config_file)