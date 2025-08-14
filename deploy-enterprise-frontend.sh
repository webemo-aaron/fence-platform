#!/bin/bash

# Deploy Enterprise Static Frontend to Google Cloud Run
set -e

echo "🚀 DEPLOYING FENCE PLATFORM ENTERPRISE FRONTEND"
echo "==============================================="

PROJECT_ID="servicehive-f009f"
REGION="us-central1"
SERVICE_ACCOUNT="fence-platform-sa@$PROJECT_ID.iam.gserviceaccount.com"

cd frontend-enterprise-static

echo "📦 Adding express dependency..."
npm init -y > /dev/null 2>&1
echo '{"name":"fence-enterprise-frontend","version":"2.0.0","main":"server.js","dependencies":{"express":"^4.18.2"},"scripts":{"start":"node server.js"}}' > package.json

echo "🚀 Deploying Enterprise Frontend to Cloud Run..."
gcloud run deploy fence-enterprise-frontend \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $SERVICE_ACCOUNT \
    --port 8080 \
    --memory 256Mi \
    --min-instances 0 \
    --max-instances 5 \
    --set-env-vars NODE_ENV=production \
    --project $PROJECT_ID

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe fence-enterprise-frontend \
    --region $REGION \
    --project $PROJECT_ID \
    --format 'value(status.url)')

cd ..

echo ""
echo "=============================================="
echo "🎉 ENTERPRISE FRONTEND DEPLOYED!"
echo "=============================================="
echo ""
echo "🌐 FRONTEND URLS:"
echo "  Enterprise:     $FRONTEND_URL"
echo "  Professional:   Current HTML UI"
echo ""
echo "🏢 ENTERPRISE FEATURES:"
echo "  ✅ Advanced analytics dashboard"
echo "  ✅ Facebook business integration"
echo "  ✅ Enterprise ROI calculator"
echo "  ✅ White-label capabilities"
echo "  ✅ Custom integrations ready"
echo "  ✅ Dedicated support tier"
echo ""
echo "🧪 TEST THE ENTERPRISE FRONTEND:"
echo "  curl $FRONTEND_URL"
echo ""

# Test the deployment
echo "Testing Enterprise frontend..."
if curl -s "$FRONTEND_URL" | grep -q "Enterprise"; then
    echo "✅ Enterprise frontend is live!"
else
    echo "❌ Enterprise frontend test failed"
fi