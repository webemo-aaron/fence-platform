#!/bin/bash

# Deploy React Frontend to Google Cloud Run
set -e

echo "🚀 DEPLOYING FENCE PLATFORM FRONTEND"
echo "===================================="

PROJECT_ID="servicehive-f009f"
REGION="us-central1" 
SERVICE_ACCOUNT="fence-platform-sa@$PROJECT_ID.iam.gserviceaccount.com"

cd frontend-react

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building React application..."
npm run build

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy fence-frontend \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $SERVICE_ACCOUNT \
    --port 8080 \
    --memory 512Mi \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars NODE_ENV=production \
    --project $PROJECT_ID

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe fence-frontend \
    --region $REGION \
    --project $PROJECT_ID \
    --format 'value(status.url)')

echo ""
echo "=============================================="
echo "🎉 FRONTEND DEPLOYMENT COMPLETE!"
echo "=============================================="
echo ""
echo "🌐 Frontend URL: $FRONTEND_URL"
echo ""
echo "📱 FEATURES AVAILABLE:"
echo "  ✅ React SPA with modern UI"
echo "  ✅ Facebook OAuth integration" 
echo "  ✅ Real-time pricing calculator"
echo "  ✅ Social media management"
echo "  ✅ Responsive mobile design"
echo "  ✅ Secure microservices integration"
echo ""
echo "🧪 TEST THE FRONTEND:"
echo "  curl $FRONTEND_URL/health"
echo ""

# Test the deployment
echo "Testing frontend health..."
if curl -s "$FRONTEND_URL/health" | grep -q "healthy"; then
    echo "✅ Frontend is healthy!"
else
    echo "❌ Frontend health check failed"
fi