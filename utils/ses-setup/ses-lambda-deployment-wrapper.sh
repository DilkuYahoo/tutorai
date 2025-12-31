#!/usr/bin/env bash
set -euo pipefail

echo "Starting deployment workflow..."

# Deploy Lambda
echo "Deploying Lambda..."
cd lambda
python deploy_lambda.py --action destroy
python deploy_lambda.py --action deploy
cd ..

# Reconfigure SES
echo "Reconfiguring SES..."
python ses-setup.py --destroy
python ses-setup.py

echo "Deployment workflow completed successfully."
