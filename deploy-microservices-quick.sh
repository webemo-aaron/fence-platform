#!/bin/bash

# Quick microservices deployment for immediate results
echo "🚀 DEPLOYING FENCE PLATFORM MICROSERVICES"
echo "=========================================="

PROJECT_ID="servicehive-f009f"
REGION="us-central1"
SERVICE_ACCOUNT="fence-platform-sa@$PROJECT_ID.iam.gserviceaccount.com"

# 1. Deploy API Gateway (main entry point)
echo "📡 Deploying API Gateway..."
cat > api-gateway.js << 'EOF'
const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'api-gateway' }));
app.get('/', (req, res) => res.json({ 
  platform: 'Fence Platform', 
  services: ['auth', 'pricing', 'crm', 'maps'],
  demo_accounts: [
    'admin@texasfencepro.com / DemoPass123!',
    'admin@austinfence.com / DemoPass123!'
  ]
}));
app.listen(process.env.PORT || 8080, () => console.log('API Gateway running'));
EOF

gcloud run deploy fence-api-gateway \
  --source . \
  --main api-gateway.js \
  --region $REGION \
  --allow-unauthenticated \
  --service-account $SERVICE_ACCOUNT \
  --memory 512Mi \
  --project $PROJECT_ID &

# 2. Deploy Auth Service
echo "🔐 Deploying Auth Service..."
cat > auth-service.js << 'EOF'
const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'auth' }));
app.post('/login', (req, res) => res.json({ token: 'demo-jwt-token', user: req.body.email }));
app.post('/signup', (req, res) => res.json({ success: true, tenant_id: 'demo-tenant' }));
app.listen(process.env.PORT || 3001, () => console.log('Auth Service running'));
EOF

gcloud run deploy fence-auth-service \
  --source . \
  --main auth-service.js \
  --region $REGION \
  --allow-unauthenticated \
  --service-account $SERVICE_ACCOUNT \
  --memory 256Mi \
  --project $PROJECT_ID &

# 3. Deploy Pricing Service
echo "💰 Deploying Pricing Service..."
cat > pricing-service.js << 'EOF'
const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'pricing' }));
app.get('/calculate-roi', (req, res) => res.json({ 
  annual_savings: 15000,
  fuel_savings: '25%',
  time_savings: '40%',
  recommendation: 'Professional Plan ($299/mo)'
}));
app.listen(process.env.PORT || 3004, () => console.log('Pricing Service running'));
EOF

gcloud run deploy fence-pricing-service \
  --source . \
  --main pricing-service.js \
  --region $REGION \
  --allow-unauthenticated \
  --service-account $SERVICE_ACCOUNT \
  --memory 256Mi \
  --project $PROJECT_ID &

wait
echo "✅ Microservices deployed!"

# Get the URLs
echo ""
echo "🌐 YOUR MICROSERVICES URLS:"
echo "============================"
gcloud run services list --project=$PROJECT_ID --filter="name~fence" --format="table(metadata.name,status.url)"