#!/bin/bash

# Deploy Simplified React Enterprise Frontend to Google Cloud Run
set -e

echo "🚀 DEPLOYING SIMPLIFIED REACT ENTERPRISE FRONTEND"
echo "================================================="

PROJECT_ID="servicehive-f009f"
REGION="us-central1"
SERVICE_ACCOUNT="fence-platform-sa@$PROJECT_ID.iam.gserviceaccount.com"

cd frontend-react-simple

echo "📦 Preparing React build..."
# Generate package-lock.json if needed
if [ ! -f "package-lock.json" ]; then
    echo "Generating package-lock.json..."
    npm install --package-lock-only
fi

echo "🚀 Deploying React Enterprise Frontend to Cloud Run..."
gcloud run deploy fence-react-enterprise \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $SERVICE_ACCOUNT \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production \
    --project $PROJECT_ID

# Get frontend URL
REACT_URL=$(gcloud run services describe fence-react-enterprise \
    --region $REGION \
    --project $PROJECT_ID \
    --format 'value(status.url)')

cd ..

echo ""
echo "=============================================="
echo "🎉 REACT ENTERPRISE FRONTEND DEPLOYED!"
echo "=============================================="
echo ""
echo "🌐 COMPLETE THREE-TIER FRONTEND SOLUTION:"
echo "  React Enterprise:     $REACT_URL"
echo "  Static Enterprise:    https://fence-enterprise-frontend-453424326027.us-central1.run.app"
echo "  Professional HTML:    https://fence-professional-frontend-453424326027.us-central1.run.app"
echo ""
echo "⚛️ REACT ENTERPRISE FEATURES:"
echo "  ✅ Component-based modular architecture"
echo "  ✅ Real-time React state management"
echo "  ✅ Seamless microservices integration"
echo "  ✅ Enterprise-grade user experience"
echo "  ✅ Simplified build without complex tooling"
echo "  ✅ Production-ready React 18 deployment"
echo ""
echo "🧩 REACT MODULES INCLUDED:"
echo "  📊 Dashboard Module - Real-time analytics"
echo "  💰 Pricing Module - ROI calculator"
echo "  📱 Social Module - Facebook integration"
echo "  🏠 Home Module - Landing experience"
echo "  🧩 Architecture Module - Component showcase"
echo ""

# Test the deployment
echo "Testing React Enterprise frontend..."
if curl -s "$REACT_URL" | grep -q "React"; then
    echo "✅ React Enterprise frontend is live!"
    echo ""
    echo "🧪 TEST ALL THREE FRONTENDS:"
    echo "  React:        curl $REACT_URL"
    echo "  Static:       curl https://fence-enterprise-frontend-453424326027.us-central1.run.app"
    echo "  Professional: curl https://fence-professional-frontend-453424326027.us-central1.run.app"
else
    echo "❌ React Enterprise frontend test failed"
fi