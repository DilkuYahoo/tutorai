import requests
import json
import os
import datetime

def load_config():
    with open("config.json", "r") as f:
        return json.load(f)

def fetch_product_details(config):
    for bank, bank_config in config["banks"].items():
        try:
            with open(f"products/{bank}/products.json", "r") as f:
                products = json.load(f)
        except FileNotFoundError:
            print(f"Products file for {bank} not found.")
            continue

        product_ids = [product["productId"] for product in products]

        base_url = bank_config["base_url"]
        headers = bank_config["headers_prd_details"]

        date_str = datetime.datetime.now().strftime("%Y-%m-%d")
        os.makedirs(f"products/{bank}/details/{date_str}", exist_ok=True)

        for product_id in product_ids:
            try:
                url = base_url + "/" + product_id
                response = requests.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()

                with open(f"products/{bank}/details/{date_str}/{product_id}.json", "w") as f:
                    json.dump(data, f, indent=4)
                print(f"Saved details for {product_id} from {bank}")
            except Exception as e:
                with open("api_errors.log", "a") as f:
                    f.write(f"Error for product {product_id} from {bank}: {str(e)}\n")

def main():
    config = load_config()
    fetch_product_details(config)

if __name__ == "__main__":
    main()