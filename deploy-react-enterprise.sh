#!/bin/bash

# Deploy React Enterprise Frontend to Google Cloud Run
set -e

echo "🚀 DEPLOYING FENCE PLATFORM REACT ENTERPRISE FRONTEND"
echo "====================================================="

PROJECT_ID="servicehive-f009f"
REGION="us-central1"
SERVICE_ACCOUNT="fence-platform-sa@$PROJECT_ID.iam.gserviceaccount.com"

cd frontend-react

echo "📦 Verifying React build configuration..."
if [ ! -f "package-lock.json" ]; then
    echo "Generating package-lock.json..."
    npm install --package-lock-only
fi

echo "🚀 Deploying React Enterprise Frontend to Cloud Run..."
gcloud run deploy fence-react-enterprise-frontend \
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
REACT_FRONTEND_URL=$(gcloud run services describe fence-react-enterprise-frontend \
    --region $REGION \
    --project $PROJECT_ID \
    --format 'value(status.url)')

cd ..

echo ""
echo "=============================================="
echo "🎉 REACT ENTERPRISE FRONTEND DEPLOYED!"
echo "=============================================="
echo ""
echo "🌐 FRONTEND COMPARISON:"
echo "  React Enterprise:    $REACT_FRONTEND_URL"
echo "  Static Enterprise:   https://fence-enterprise-frontend-453424326027.us-central1.run.app"
echo "  Professional HTML:   Local ui-professional/index.html"
echo ""
echo "💼 ENTERPRISE REACT FEATURES:"
echo "  ✅ Modular React architecture"
echo "  ✅ Vite build system"
echo "  ✅ Component-based design"
echo "  ✅ React Router navigation"
echo "  ✅ Context API state management"
echo "  ✅ Tailwind CSS styling"
echo "  ✅ Full microservices integration"
echo ""
echo "🧪 TEST THE REACT ENTERPRISE FRONTEND:"
echo "  curl $REACT_FRONTEND_URL"
echo ""

# Test the deployment
echo "Testing React Enterprise frontend..."
if curl -s "$REACT_FRONTEND_URL" | grep -q "Fence Platform"; then
    echo "✅ React Enterprise frontend is live!"
else
    echo "❌ React Enterprise frontend test failed"
fi