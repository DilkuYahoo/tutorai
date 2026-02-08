import boto3
import sys
import time

# ==========================================================
# CONFIGURATION — EDIT EVERYTHING HERE
# ==========================================================

CONFIG = {
    "region": "ap-southeast-2",
    "user_pool_name": "AdviceGenieUserPool",
    "app_client_name": "AdviceGenieSPA",
    "domain_prefix": "advicegenie-auth-baportal-001",  # must be globally unique
    "callback_urls": [
        "http://localhost:3000/",
        "https://advicegenie.com.au/"
    ],
    "logout_urls": [
        "http://localhost:3000/",
        "https://advicegenie.com.au/"
    ],
    "allowed_oauth_scopes": ["openid", "email", "profile"],
}

# ==========================================================
# AWS CLIENT
# ==========================================================

cognito = boto3.client("cognito-idp", region_name=CONFIG["region"])

# ==========================================================
# HELPERS
# ==========================================================

def find_user_pool():
    pools = cognito.list_user_pools(MaxResults=60)["UserPools"]
    for p in pools:
        if p["Name"] == CONFIG["user_pool_name"]:
            return p["Id"]
    return None


def find_app_client(user_pool_id):
    clients = cognito.list_user_pool_clients(
        UserPoolId=user_pool_id,
        MaxResults=60
    )["UserPoolClients"]

    for c in clients:
        if c["ClientName"] == CONFIG["app_client_name"]:
            return c["ClientId"]
    return None


# ==========================================================
# CREATE FLOW
# ==========================================================

def create_user_pool():
    print("Creating user pool...")

    resp = cognito.create_user_pool(
        PoolName=CONFIG["user_pool_name"],
        AutoVerifiedAttributes=["email"],
        UsernameAttributes=["email"],
        Policies={
            "PasswordPolicy": {
                "MinimumLength": 8,
                "RequireUppercase": True,
                "RequireLowercase": True,
                "RequireNumbers": True,
                "RequireSymbols": True,
            }
        },
        AccountRecoverySetting={
            "RecoveryMechanisms": [{"Name": "verified_email", "Priority": 1}]
        }
    )

    user_pool_id = resp["UserPool"]["Id"]
    print("User Pool created:", user_pool_id)
    return user_pool_id


def create_domain(user_pool_id):
    print("Creating hosted UI domain...")
    cognito.create_user_pool_domain(
        Domain=CONFIG["domain_prefix"],
        UserPoolId=user_pool_id
    )

    print("Waiting for domain to become active...")
    time.sleep(20)


def create_app_client(user_pool_id):
    print("Creating app client...")

    resp = cognito.create_user_pool_client(
        UserPoolId=user_pool_id,
        ClientName=CONFIG["app_client_name"],
        GenerateSecret=False,
        AllowedOAuthFlowsUserPoolClient=True,
        AllowedOAuthFlows=["code"],
        AllowedOAuthScopes=CONFIG["allowed_oauth_scopes"],
        CallbackURLs=CONFIG["callback_urls"],
        LogoutURLs=CONFIG["logout_urls"],
        SupportedIdentityProviders=["COGNITO"],
    )

    client_id = resp["UserPoolClient"]["ClientId"]
    print("App Client created:", client_id)
    return client_id


def create_all():
    if find_user_pool():
        print("User pool already exists. Aborting.")
        return

    user_pool_id = create_user_pool()
    create_domain(user_pool_id)
    client_id = create_app_client(user_pool_id)

    print("\n====================================")
    print("SETUP COMPLETE 🎉")
    print("UserPoolId:", user_pool_id)
    print("AppClientId:", client_id)
    print("Hosted UI:")
    print(
        f"https://{CONFIG['domain_prefix']}.auth.{CONFIG['region']}.amazoncognito.com/login"
    )
    print("====================================")


# ==========================================================
# DESTROY FLOW
# ==========================================================

def delete_domain(user_pool_id):
    try:
        cognito.delete_user_pool_domain(
            Domain=CONFIG["domain_prefix"],
            UserPoolId=user_pool_id
        )
        print("Domain deleted")
    except Exception as e:
        print("Domain deletion skipped:", e)


def delete_app_client(user_pool_id):
    client_id = find_app_client(user_pool_id)
    if not client_id:
        return
    cognito.delete_user_pool_client(
        UserPoolId=user_pool_id,
        ClientId=client_id
    )
    print("App client deleted")


def delete_user_pool(user_pool_id):
    cognito.delete_user_pool(UserPoolId=user_pool_id)
    print("User pool deleted")


def destroy_all():
    user_pool_id = find_user_pool()

    if not user_pool_id:
        print("No user pool found. Nothing to destroy.")
        return

    delete_app_client(user_pool_id)
    delete_domain(user_pool_id)
    time.sleep(5)
    delete_user_pool(user_pool_id)

    print("\nEnvironment destroyed 💥")


# ==========================================================
# ENTRY POINT
# ==========================================================

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python cognito_setup.py [create|destroy]")
        sys.exit(1)

    action = sys.argv[1].lower()

    if action == "create":
        create_all()
    elif action == "destroy":
        destroy_all()
    else:
        print("Unknown command.")
