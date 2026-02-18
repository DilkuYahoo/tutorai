#!/bin/bash
# Deployment Script for Auth Login Cognito Test Page
# This script deploys both Lambda and API Gateway

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGION="ap-southeast-2"

echo "=============================================="
echo "Auth Login Deployment Script"
echo "=============================================="

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "Error: AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

# Parse arguments
DEPLOY_FRONTEND=false
DEPLOY_LAMBDA=true
DEPLOY_API=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --frontend-only)
            DEPLOY_FRONTEND=true
            DEPLOY_LAMBDA=false
            DEPLOY_API=false
            shift
            ;;
        --lambda-only)
            DEPLOY_LAMBDA=true
            DEPLOY_API=false
            shift
            ;;
        --api-only)
            DEPLOY_LAMBDA=false
            DEPLOY_API=true
            shift
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--frontend-only|--lambda-only|--api-only] [--region <region>]"
            exit 1
            ;;
    esac
done

# Deploy Lambda
if [ "$DEPLOY_LAMBDA" = true ]; then
    echo ""
    echo "Step 1: Deploying Lambda Function..."
    echo "------------------------------"
    cd "$SCRIPT_DIR/IaC"
    python deploy_lambda.py --region "$REGION"
fi

# Deploy API Gateway
if [ "$DEPLOY_API" = true ]; then
    echo ""
    echo "Step 2: Deploying API Gateway..."
    echo "------------------------------"
    cd "$SCRIPT_DIR/IaC"
    python deploy_api.py --region "$REGION"
fi

# Build Frontend
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo ""
    echo "Step 3: Building Frontend..."
    echo "------------------------------"
    cd "$SCRIPT_DIR/frontend"
    
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    echo "Building React app..."
    npm run build
    
    echo ""
    echo "Frontend built successfully in: $SCRIPT_DIR/frontend/dist"
    echo "Deploy the contents to S3 or your hosting service."
fi

echo ""
echo "=============================================="
echo "Deployment Complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo "1. Update the Cognito configuration in frontend/src/config/cognitoConfig.js"
echo "2. Update the API URL in frontend/.env"
echo "3. Build and deploy the frontend: cd frontend && npm run build"
echo "4. Add the frontend URL to Cognito callback URLs"
echo ""
