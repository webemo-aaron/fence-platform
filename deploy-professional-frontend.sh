#!/bin/bash

# Deploy Professional HTML Frontend to Google Cloud Run
set -e

echo "🚀 DEPLOYING FENCE PLATFORM PROFESSIONAL FRONTEND"
echo "================================================="

PROJECT_ID="servicehive-f009f"
REGION="us-central1"
SERVICE_ACCOUNT="fence-platform-sa@$PROJECT_ID.iam.gserviceaccount.com"

# Create professional frontend directory structure
mkdir -p professional-frontend
cd professional-frontend

# Copy the professional UI
cp ../ui-professional/index.html .

# Create package.json for deployment
cat > package.json << 'EOF'
{
  "name": "fence-professional-frontend",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node server.js"
  }
}
EOF

# Create server.js for serving the HTML
cat > server.js << 'EOF'
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files
app.use(express.static(__dirname));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'professional-frontend' });
});

app.listen(PORT, () => {
  console.log(`Professional Frontend running on port ${PORT}`);
});
EOF

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy app files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S frontend -u 1001 -G nodejs

# Set ownership
RUN chown -R frontend:nodejs /app

# Switch to non-root user
USER frontend

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the application
CMD ["npm", "start"]
EOF

echo "🚀 Deploying Professional Frontend to Cloud Run..."
gcloud run deploy fence-professional-frontend \
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
PROFESSIONAL_URL=$(gcloud run services describe fence-professional-frontend \
    --region $REGION \
    --project $PROJECT_ID \
    --format 'value(status.url)')

cd ..

echo ""
echo "=============================================="
echo "🎉 PROFESSIONAL FRONTEND DEPLOYED!"
echo "=============================================="
echo ""
echo "🌐 COMPLETE TWO-TIER FRONTEND SOLUTION:"
echo "  Professional:        $PROFESSIONAL_URL"
echo "  Enterprise Static:   https://fence-enterprise-frontend-453424326027.us-central1.run.app"
echo ""
echo "💼 PROFESSIONAL FEATURES ($299/month):"
echo "  ✅ Advanced ROI Calculator with Chart.js"
echo "  ✅ Facebook Business Integration"
echo "  ✅ Professional analytics dashboard"
echo "  ✅ Export functionality"
echo "  ✅ Direct microservices integration"
echo "  ✅ Unlimited jobs and phone support"
echo ""
echo "🏢 ENTERPRISE FEATURES ($599/month):"
echo "  ✅ Everything in Professional PLUS:"
echo "  ✅ Advanced microservices architecture"
echo "  ✅ White-label capabilities"
echo "  ✅ Custom integrations and APIs"
echo "  ✅ Dedicated support and SLA"
echo "  ✅ Multi-tenant security"
echo ""

# Test the deployment
echo "Testing Professional frontend..."
if curl -s "$PROFESSIONAL_URL" | grep -q "Professional"; then
    echo "✅ Professional frontend is live!"
    echo ""
    echo "🧪 TEST BOTH FRONTENDS:"
    echo "  curl $PROFESSIONAL_URL"
    echo "  curl https://fence-enterprise-frontend-453424326027.us-central1.run.app"
else
    echo "❌ Professional frontend test failed"
fi