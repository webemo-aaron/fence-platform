# 🚀 Complete GCP Deployment Guide

## Quick Setup (15 Minutes)

### Step 1: Initialize GitHub Repository

```bash
# Navigate to project directory
cd /mnt/c/GCP/ServiceHive/src/invisible-fence-automation

# Initialize git repository
git init

# Create GitHub repository (using GitHub CLI)
gh repo create fence-platform --public --source=. --remote=origin

# OR manually create on GitHub and add remote
git remote add origin https://github.com/YOUR_USERNAME/fence-platform.git

# Add all files
git add .
git commit -m "Initial commit: Multi-tenant fence platform"
git branch -M main
git push -u origin main
```

### Step 2: Run GCP Setup Script

```bash
# Make script executable
chmod +x scripts/gcp-setup.sh

# Run setup (replace with your project ID)
./scripts/gcp-setup.sh YOUR-GCP-PROJECT-ID us-central1

# This will:
# ✓ Enable required APIs
# ✓ Create service accounts
# ✓ Set up Cloud SQL databases
# ✓ Create secrets in Secret Manager
# ✓ Configure Cloud Run services
# ✓ Generate service account key
```

### Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add these secrets:

```yaml
GCP_PROJECT_ID: your-gcp-project-id
GCP_SA_KEY: # Paste entire contents of gcp-sa-key.json
DATABASE_URL: # Get from GCP Secret Manager
SLACK_WEBHOOK: # Optional - for notifications
```

4. Delete local key file:
```bash
rm gcp-sa-key.json
```

### Step 4: Trigger First Deployment

```bash
# Push to trigger deployment
git push origin main

# OR manually trigger from GitHub Actions tab
```

## 📋 Pre-Deployment Checklist

### GCP Project Setup
- [ ] GCP Project created with billing enabled
- [ ] Project ID noted: ________________
- [ ] gcloud CLI installed and authenticated
- [ ] APIs enabled (Run, Cloud Build, SQL, Secret Manager)

### GitHub Setup
- [ ] Repository created
- [ ] Code pushed to main branch
- [ ] Secrets configured in repository settings

### Configuration
- [ ] Database passwords set
- [ ] JWT secret generated
- [ ] Stripe keys added (optional)
- [ ] SendGrid API key added (optional)

## 🏗️ Architecture Overview

```
GitHub Push → GitHub Actions → Cloud Build → Cloud Run
                                     ↓
                              Cloud SQL (PostgreSQL)
                                     ↓
                              Secret Manager
```

### Services Created

| Service | Purpose | URL Pattern |
|---------|---------|-------------|
| fence-platform | Production | fence-platform-xxxxx-uc.a.run.app |
| fence-platform-staging | Staging | fence-platform-staging-xxxxx-uc.a.run.app |
| fence-platform-demo | Demo | fence-platform-demo-xxxxx-uc.a.run.app |

### Database Instances

| Instance | Environment | Backup | Tier |
|----------|------------|--------|------|
| fence-platform-db | Production | Daily | db-f1-micro |
| fence-platform-staging-db | Staging | None | db-f1-micro |
| fence-platform-demo-db | Demo | None | db-f1-micro |

## 🔧 Manual GCP Setup Commands

If the script fails, run these commands manually:

### 1. Enable APIs
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  sqladmin.googleapis.com
```

### 2. Create Service Account
```bash
gcloud iam service-accounts create fence-platform-sa \
  --display-name="Fence Platform Service Account"

# Get email
SA_EMAIL=fence-platform-sa@YOUR-PROJECT-ID.iam.gserviceaccount.com

# Grant permissions
gcloud projects add-iam-policy-binding YOUR-PROJECT-ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/run.developer"
```

### 3. Create Cloud SQL Instance
```bash
gcloud sql instances create fence-platform-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create fence_platform \
  --instance=fence-platform-db

# Set password
gcloud sql users set-password postgres \
  --instance=fence-platform-db \
  --password=YOUR_PASSWORD
```

### 4. Create Secrets
```bash
# JWT Secret
echo -n "$(openssl rand -base64 32)" | \
  gcloud secrets create jwt-secret --data-file=-

# Database URL
echo -n "postgresql://postgres:PASSWORD@/fence_platform?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets create database-url-production --data-file=-
```

### 5. Create Artifact Registry
```bash
gcloud artifacts repositories create fence-platform \
  --repository-format=docker \
  --location=us-central1
```

## 🌐 Custom Domain Setup

### 1. Map Custom Domain to Cloud Run

```bash
# Production
gcloud run domain-mappings create \
  --service=fence-platform \
  --domain=fenceplatform.io \
  --region=us-central1

# Get DNS records to add
gcloud run domain-mappings describe \
  --domain=fenceplatform.io \
  --region=us-central1
```

### 2. Configure DNS Records

Add to your DNS provider:

```
Type: A
Name: @
Value: [IP from GCP]

Type: AAAA  
Name: @
Value: [IPv6 from GCP]

Type: CNAME
Name: www
Value: ghs.googlehosted.com

Type: CNAME
Name: *.
Value: ghs.googlehosted.com
```

### 3. Verify Domain

```bash
# Check status
gcloud run domain-mappings list --region=us-central1

# Wait for SSL certificate (can take up to 24 hours)
```

## 📊 Monitoring Setup

### 1. Enable Monitoring APIs
```bash
gcloud services enable \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudtrace.googleapis.com
```

### 2. Create Uptime Checks
```bash
gcloud monitoring uptime-checks create fence-platform-health \
  --display-name="Fence Platform Health Check" \
  --uri="https://fence-platform-xxxxx-uc.a.run.app/health"
```

### 3. Set Up Alerts
```bash
# CPU utilization alert
gcloud alpha monitoring policies create \
  --notification-channels=YOUR_CHANNEL_ID \
  --display-name="High CPU Usage" \
  --condition-display-name="CPU > 80%" \
  --condition-expression='
    resource.type="cloud_run_revision" AND
    metric.type="run.googleapis.com/container/cpu/utilizations" AND
    metric.value > 0.8'
```

### 4. View Logs
```bash
# Recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=fence-platform" \
  --limit=50 \
  --format=json

# Stream logs
gcloud alpha run services logs tail fence-platform --region=us-central1
```

## 🔐 Security Best Practices

### 1. Service Account Permissions
- Use least privilege principle
- Separate service accounts per environment
- Rotate keys regularly

### 2. Secret Management
- Never commit secrets to git
- Use Secret Manager for all sensitive data
- Rotate secrets quarterly

### 3. Network Security
- Enable Cloud Armor for DDoS protection
- Use VPC Service Controls
- Implement rate limiting

### 4. Database Security
- Use Cloud SQL Auth proxy
- Enable automatic backups
- Implement point-in-time recovery

## 💰 Cost Optimization

### Estimated Monthly Costs

| Service | Configuration | Cost/Month |
|---------|--------------|------------|
| Cloud Run | 1 vCPU, 1GB RAM | ~$15 |
| Cloud SQL | db-f1-micro x3 | ~$30 |
| Secret Manager | < 10K operations | ~$1 |
| Cloud Storage | 10GB backups | ~$1 |
| **Total** | | **~$47/month** |

### Cost Saving Tips

1. **Use min-instances=0 for staging/demo**
```yaml
gcloud run services update fence-platform-staging \
  --min-instances=0
```

2. **Schedule staging database stop/start**
```bash
# Stop at night
gcloud sql instances patch fence-platform-staging-db \
  --activation-policy=NEVER

# Start in morning
gcloud sql instances patch fence-platform-staging-db \
  --activation-policy=ALWAYS
```

3. **Use Cloud CDN for static assets**
```bash
gcloud compute backend-buckets create fence-static \
  --gcs-bucket-name=fence-platform-static
```

## 🚨 Troubleshooting

### Deployment Fails

```bash
# Check Cloud Build logs
gcloud builds list --limit=5

# View specific build
gcloud builds describe BUILD_ID

# Check service logs
gcloud run services logs read fence-platform --region=us-central1
```

### Database Connection Issues

```bash
# Test connection
gcloud sql connect fence-platform-db --user=postgres

# Check Cloud SQL proxy
gcloud sql instances describe fence-platform-db
```

### Service Not Accessible

```bash
# Check service status
gcloud run services describe fence-platform --region=us-central1

# Check IAM permissions
gcloud run services get-iam-policy fence-platform --region=us-central1
```

## 📈 Performance Optimization

### 1. Enable Cloud CDN
```bash
gcloud compute backend-services update fence-platform-backend \
  --enable-cdn \
  --cache-mode=CACHE_ALL_STATIC
```

### 2. Configure Autoscaling
```bash
gcloud run services update fence-platform \
  --min-instances=1 \
  --max-instances=100 \
  --concurrency=100 \
  --cpu=2 \
  --memory=2Gi
```

### 3. Set Up Cloud Memorystore (Redis)
```bash
gcloud redis instances create fence-cache \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_6_x
```

## 🔄 CI/CD Pipeline

### Environments

| Branch | Environment | Auto Deploy | Approval |
|--------|------------|-------------|----------|
| main | Staging | Yes | No |
| production | Production | Yes | Required |
| feature/* | None | No | N/A |

### Manual Deployment

```bash
# Deploy specific version
gh workflow run deploy-gcp.yml \
  -f environment=production \
  -f version=v1.2.3

# Rollback
gcloud run services update-traffic fence-platform \
  --to-revisions=fence-platform-00001-abc=100
```

## ✅ Post-Deployment Verification

### 1. Health Checks
```bash
# Production
curl https://fence-platform-xxxxx-uc.a.run.app/health

# Staging
curl https://fence-platform-staging-xxxxx-uc.a.run.app/health

# Demo
curl https://fence-platform-demo-xxxxx-uc.a.run.app/health
```

### 2. Test Authentication
```bash
# Get demo token
curl -X POST https://fence-platform-demo-xxxxx-uc.a.run.app/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@fenceplatform.io","password":"DemoPass123!"}'
```

### 3. Verify Database
```bash
# Connect to production database
gcloud sql connect fence-platform-db --user=postgres --database=fence_platform

# Check tables
\dt

# Check demo data
SELECT COUNT(*) FROM organizations;
```

## 🎉 Success!

Your multi-tenant fence platform is now deployed on Google Cloud Platform with:

- ✅ Automatic CI/CD via GitHub Actions
- ✅ Multi-environment setup (Production, Staging, Demo)
- ✅ PostgreSQL databases with backups
- ✅ Secret management
- ✅ Health monitoring
- ✅ Auto-scaling
- ✅ SSL certificates

### Next Steps

1. **Share demo URL** with customers for feedback
2. **Configure custom domain** for production
3. **Set up monitoring alerts**
4. **Enable additional features** (Stripe, SendGrid, etc.)
5. **Start onboarding customers!**

---

**Need help?** Check the [troubleshooting section](#-troubleshooting) or open an issue on GitHub.