#!/bin/bash

# Quick deployment script for fence platform
echo "🚀 Quick Deploy - Fence Platform"
echo "================================"

# Build and deploy in one command
echo "Building and deploying fence-platform..."

# Use Cloud Build to build and deploy directly
gcloud run deploy fence-platform \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --service-account fence-platform-sa@servicehive-f009f.iam.gserviceaccount.com \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,PORT=3000" \
  --add-cloudsql-instances servicehive-f009f:us-central1:fence-platform-db \
  --set-secrets "DATABASE_URL=database-url-production:latest,JWT_SECRET=jwt-secret:latest" \
  --project servicehive-f009f

echo "✅ Production deployed!"

# Deploy demo environment
gcloud run deploy fence-platform-demo \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --service-account fence-platform-sa@servicehive-f009f.iam.gserviceaccount.com \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=demo,PORT=3000,DEMO_MODE=true" \
  --add-cloudsql-instances servicehive-f009f:us-central1:fence-platform-demo-db \
  --set-secrets "DATABASE_URL=database-url-demo:latest,JWT_SECRET=jwt-secret:latest" \
  --project servicehive-f009f

echo "✅ Demo environment deployed!"
echo ""
echo "🌐 Your services are live at:"
echo "Production: https://fence-platform-453424326027.us-central1.run.app"
echo "Demo: https://fence-platform-demo-453424326027.us-central1.run.app"