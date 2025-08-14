#!/bin/bash

# =====================================================
# GCP Project Setup Script for Fence Platform
# Run this once to configure your GCP project
# =====================================================

set -e

# Configuration
PROJECT_ID=${1:-$GCP_PROJECT_ID}
REGION=${2:-us-central1}
SERVICE_ACCOUNT_NAME="fence-platform-sa"
ARTIFACT_REPO_NAME="fence-platform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Setting up GCP Project for Fence Platform"
echo "============================================"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set the project
echo "📋 Setting project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔌 Enabling required APIs..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com \
    compute.googleapis.com \
    cloudresourcemanager.googleapis.com \
    iam.googleapis.com \
    --project $PROJECT_ID

echo -e "${GREEN}✓ APIs enabled${NC}"

# Create Artifact Registry repository
echo "📦 Creating Artifact Registry repository..."
gcloud artifacts repositories create $ARTIFACT_REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker images for Fence Platform" \
    --project=$PROJECT_ID || echo "Repository already exists"

# Create service account
echo "👤 Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Fence Platform Service Account" \
    --project=$PROJECT_ID || echo "Service account already exists"

# Grant necessary permissions to service account
echo "🔐 Granting permissions..."
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Cloud Run permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/run.developer"

# Cloud SQL permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/cloudsql.client"

# Secret Manager permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

# Storage permissions (for backups)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.objectAdmin"

echo -e "${GREEN}✓ Permissions granted${NC}"

# Create Cloud SQL instances
echo "💾 Setting up Cloud SQL instances..."

# Production database
echo "Creating production database..."
gcloud sql instances create fence-platform-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --network=default \
    --backup-start-time=03:00 \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=04 \
    --maintenance-release-channel=production \
    --project=$PROJECT_ID || echo "Production database already exists"

# Staging database
echo "Creating staging database..."
gcloud sql instances create fence-platform-staging-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --network=default \
    --backup-start-time=04:00 \
    --no-backup \
    --project=$PROJECT_ID || echo "Staging database already exists"

# Demo database
echo "Creating demo database..."
gcloud sql instances create fence-platform-demo-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --network=default \
    --no-backup \
    --project=$PROJECT_ID || echo "Demo database already exists"

echo -e "${GREEN}✓ Cloud SQL instances created${NC}"

# Create databases
echo "📊 Creating databases..."
for INSTANCE in "fence-platform-db" "fence-platform-staging-db" "fence-platform-demo-db"; do
    gcloud sql databases create fence_platform \
        --instance=$INSTANCE \
        --project=$PROJECT_ID || echo "Database already exists on $INSTANCE"
done

# Set database passwords
echo "🔑 Setting database passwords..."
read -s -p "Enter database password for production: " PROD_DB_PASSWORD
echo ""
gcloud sql users set-password postgres \
    --instance=fence-platform-db \
    --password="$PROD_DB_PASSWORD" \
    --project=$PROJECT_ID

read -s -p "Enter database password for staging: " STAGING_DB_PASSWORD
echo ""
gcloud sql users set-password postgres \
    --instance=fence-platform-staging-db \
    --password="$STAGING_DB_PASSWORD" \
    --project=$PROJECT_ID

read -s -p "Enter database password for demo: " DEMO_DB_PASSWORD
echo ""
gcloud sql users set-password postgres \
    --instance=fence-platform-demo-db \
    --password="$DEMO_DB_PASSWORD" \
    --project=$PROJECT_ID

# Create secrets in Secret Manager
echo "🔐 Creating secrets..."

# JWT Secret
echo -n "$(openssl rand -base64 32)" | gcloud secrets create jwt-secret \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID || echo "jwt-secret already exists"

# Database URLs
echo -n "postgresql://postgres:$PROD_DB_PASSWORD@/fence_platform?host=/cloudsql/$PROJECT_ID:$REGION:fence-platform-db" | \
    gcloud secrets create database-url-production \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID || echo "database-url-production already exists"

echo -n "postgresql://postgres:$STAGING_DB_PASSWORD@/fence_platform?host=/cloudsql/$PROJECT_ID:$REGION:fence-platform-staging-db" | \
    gcloud secrets create database-url-staging \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID || echo "database-url-staging already exists"

echo -n "postgresql://postgres:$DEMO_DB_PASSWORD@/fence_platform?host=/cloudsql/$PROJECT_ID:$REGION:fence-platform-demo-db" | \
    gcloud secrets create database-url-demo \
    --data-file=- \
    --replication-policy=automatic \
    --project=$PROJECT_ID || echo "database-url-demo already exists"

# Stripe keys (placeholder - update with real keys)
read -p "Enter Stripe secret key for production (or press Enter to skip): " STRIPE_KEY_PROD
if [ ! -z "$STRIPE_KEY_PROD" ]; then
    echo -n "$STRIPE_KEY_PROD" | gcloud secrets create stripe-secret-key-production \
        --data-file=- \
        --replication-policy=automatic \
        --project=$PROJECT_ID || echo "stripe-secret-key-production already exists"
fi

read -p "Enter Stripe secret key for staging (or press Enter to skip): " STRIPE_KEY_STAGING
if [ ! -z "$STRIPE_KEY_STAGING" ]; then
    echo -n "$STRIPE_KEY_STAGING" | gcloud secrets create stripe-secret-key-staging \
        --data-file=- \
        --replication-policy=automatic \
        --project=$PROJECT_ID || echo "stripe-secret-key-staging already exists"
fi

# SendGrid API key
read -p "Enter SendGrid API key (or press Enter to skip): " SENDGRID_KEY
if [ ! -z "$SENDGRID_KEY" ]; then
    echo -n "$SENDGRID_KEY" | gcloud secrets create sendgrid-api-key \
        --data-file=- \
        --replication-policy=automatic \
        --project=$PROJECT_ID || echo "sendgrid-api-key already exists"
fi

echo -e "${GREEN}✓ Secrets created${NC}"

# Create Cloud Storage bucket for backups
echo "🪣 Creating storage bucket for backups..."
gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$PROJECT_ID-fence-platform-backups/ || echo "Bucket already exists"

# Create Cloud Run services
echo "🏃 Creating Cloud Run services..."

# Production service
gcloud run deploy fence-platform \
    --image gcr.io/cloudrun/placeholder \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $SERVICE_ACCOUNT_EMAIL \
    --project $PROJECT_ID || echo "Production service already exists"

# Staging service
gcloud run deploy fence-platform-staging \
    --image gcr.io/cloudrun/placeholder \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $SERVICE_ACCOUNT_EMAIL \
    --project $PROJECT_ID || echo "Staging service already exists"

# Demo service
gcloud run deploy fence-platform-demo \
    --image gcr.io/cloudrun/placeholder \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --service-account $SERVICE_ACCOUNT_EMAIL \
    --project $PROJECT_ID || echo "Demo service already exists"

echo -e "${GREEN}✓ Cloud Run services created${NC}"

# Create service account key for GitHub Actions
echo "🔑 Creating service account key for GitHub Actions..."
gcloud iam service-accounts keys create gcp-sa-key.json \
    --iam-account=$SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID

echo -e "${YELLOW}⚠️  IMPORTANT: Save the contents of gcp-sa-key.json as a GitHub secret named GCP_SA_KEY${NC}"
echo ""

# Output summary
echo "✅ GCP Setup Complete!"
echo "====================="
echo ""
echo "📋 Next Steps:"
echo "1. Go to your GitHub repository settings"
echo "2. Navigate to Settings > Secrets and variables > Actions"
echo "3. Add the following secrets:"
echo "   - GCP_PROJECT_ID: $PROJECT_ID"
echo "   - GCP_SA_KEY: (contents of gcp-sa-key.json)"
echo "   - DATABASE_URL: (use the appropriate secret based on environment)"
echo "   - SLACK_WEBHOOK: (optional, for notifications)"
echo ""
echo "4. Update any additional configuration in the secrets:"
echo "   - Stripe keys"
echo "   - SendGrid API key"
echo "   - Any other service credentials"
echo ""
echo "5. Commit and push to trigger deployment:"
echo "   git add ."
echo "   git commit -m 'Initial GCP deployment setup'"
echo "   git push origin main"
echo ""
echo "🌐 Your services will be available at:"
echo "   Production: https://fence-platform-xxxxx-uc.a.run.app"
echo "   Staging: https://fence-platform-staging-xxxxx-uc.a.run.app"
echo "   Demo: https://fence-platform-demo-xxxxx-uc.a.run.app"
echo ""
echo "Run 'gcloud run services list' to see the actual URLs"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to delete gcp-sa-key.json after adding it to GitHub!${NC}"
echo "rm gcp-sa-key.json"