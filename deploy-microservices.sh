#!/bin/bash

# Quick deployment script for Fence Platform Microservices
set -e

echo "🚀 DEPLOYING FENCE PLATFORM MICROSERVICES TO GCP"
echo "================================================="

PROJECT_ID="servicehive-f009f"
REGION="us-central1"
SERVICE_ACCOUNT="fence-platform-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to deploy a service
deploy_service() {
    local SERVICE_NAME=$1
    local SERVICE_DIR=$2
    local PORT=$3
    local MEMORY=$4
    
    echo -e "${YELLOW}📦 Deploying $SERVICE_NAME...${NC}"
    
    cd "microservices/$SERVICE_DIR"
    
    # Generate package-lock.json if missing
    if [ ! -f package-lock.json ]; then
        echo "  Generating package-lock.json..."
        npm install --package-lock-only
    fi
    
    # Deploy to Cloud Run
    gcloud run deploy "fence-$SERVICE_NAME" \
        --source . \
        --region $REGION \
        --allow-unauthenticated \
        --service-account $SERVICE_ACCOUNT \
        --port $PORT \
        --memory $MEMORY \
        --min-instances 0 \
        --max-instances 10 \
        --set-env-vars NODE_ENV=production \
        --project $PROJECT_ID \
        --quiet
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe "fence-$SERVICE_NAME" \
        --region $REGION \
        --project $PROJECT_ID \
        --format 'value(status.url)')
    
    echo -e "${GREEN}✅ $SERVICE_NAME deployed at: $SERVICE_URL${NC}"
    echo ""
    
    cd ../..
    
    # Return the URL for use by other services
    echo "$SERVICE_URL"
}

# Deploy services in order
echo "1️⃣ Deploying Auth Service..."
AUTH_URL=$(deploy_service "auth-service" "auth-service" "3001" "256Mi")

echo "2️⃣ Deploying Pricing Service..."
PRICING_URL=$(deploy_service "pricing-service" "pricing-service" "3004" "256Mi")

echo "3️⃣ Deploying Social Marketing Service..."
SOCIAL_URL=$(deploy_service "social-marketing-service" "social-marketing-service" "3007" "256Mi")

echo "4️⃣ Deploying API Gateway..."
cd microservices/api-gateway

# Generate package-lock.json if missing
if [ ! -f package-lock.json ]; then
    echo "  Generating package-lock.json..."
    npm install --package-lock-only
fi

# Deploy API Gateway with service URLs
gcloud run deploy fence-api-gateway \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $SERVICE_ACCOUNT \
    --port 8080 \
    --memory 512Mi \
    --min-instances 0 \
    --max-instances 20 \
    --set-env-vars NODE_ENV=production,AUTH_SERVICE_URL=$AUTH_URL,PRICING_SERVICE_URL=$PRICING_URL,SOCIAL_MARKETING_SERVICE_URL=$SOCIAL_URL \
    --project $PROJECT_ID \
    --quiet

cd ../..

# Get API Gateway URL
API_GATEWAY_URL=$(gcloud run services describe fence-api-gateway \
    --region $REGION \
    --project $PROJECT_ID \
    --format 'value(status.url)')

echo ""
echo "=============================================="
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo "=============================================="
echo ""
echo "📍 SERVICE URLS:"
echo "  API Gateway:        $API_GATEWAY_URL"
echo "  Auth Service:       $AUTH_URL"
echo "  Pricing Service:    $PRICING_URL"
echo "  Social Marketing:   $SOCIAL_URL"
echo ""
echo "🔐 DEMO ACCOUNTS:"
echo "  admin@texasfencepro.com / DemoPass123! (Professional Tier)"
echo "  admin@austinfence.com / DemoPass123! (Essential Tier)"
echo ""
echo "📱 FACEBOOK OAUTH:"
echo "  Login URL: $API_GATEWAY_URL/auth/facebook"
echo ""
echo "📊 ENDPOINTS:"
echo "  Health Check:     $API_GATEWAY_URL/health"
echo "  Login:           $API_GATEWAY_URL/api/auth/login"
echo "  Pricing Tiers:   $API_GATEWAY_URL/api/pricing/tiers"
echo "  ROI Calculator:  $API_GATEWAY_URL/api/pricing/calculate-roi"
echo "  Social Templates: $API_GATEWAY_URL/api/social/templates"
echo ""
echo "🧪 TEST COMMANDS:"
echo "  curl $API_GATEWAY_URL/health"
echo "  curl $API_GATEWAY_URL/api/pricing/tiers"
echo ""

# Test the deployment
echo "Testing API Gateway health..."
if curl -s "$API_GATEWAY_URL/health" | grep -q "healthy"; then
    echo -e "${GREEN}✅ API Gateway is healthy!${NC}"
else
    echo -e "${RED}❌ API Gateway health check failed${NC}"
fi