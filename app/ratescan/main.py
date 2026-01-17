import requests
import json
import os

def load_config():
    with open("config.json", "r") as f:
        return json.load(f)

def fetch_openbanking_data(config):
    for bank, bank_config in config["banks"].items():
        try:
            base_url = bank_config["base_url"]
            headers = bank_config["headers_prd_details"]
            all_products = []
            url = base_url

            while url:
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
            print(f"Collected {len(all_products)} products for {bank} and saved to products/{bank}/products.json")
        except Exception as e:
            with open("api_errors.log", "a") as f:
                f.write(f"Error for bank {bank}: {str(e)}\n")

def main():
    config = load_config()
    fetch_openbanking_data(config)

if __name__ == "__main__":
    main()