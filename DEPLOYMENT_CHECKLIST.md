# 🚀 Fence Platform Deployment Checklist

## ✅ Completed Infrastructure Setup

### GitHub Repository
- [x] Repository created: https://github.com/webemo-aaron/fence-platform
- [x] Code pushed to main branch
- [x] GitHub Actions workflow configured
- [x] Documentation added and committed

### Google Cloud Platform  
- [x] Project: servicehive-f009f configured
- [x] Service account created: fence-platform-sa
- [x] IAM permissions granted
- [x] Artifact Registry repository created

### Cloud SQL Databases
- [x] fence-platform-db (Production) - RUNNING
- [x] fence-platform-staging-db (Staging) - RUNNING  
- [x] fence-platform-demo-db (Demo) - RUNNING
- [x] Database passwords set
- [x] Database `fence_platform` created on all instances

### Secrets Manager
- [x] jwt-secret created
- [x] database-url-production created
- [x] database-url-staging created
- [x] database-url-demo created

## ⏳ Currently Deploying

### GitHub Actions Status
**Check deployment progress at:**
https://github.com/webemo-aaron/fence-platform/actions

**Expected workflow steps:**
1. ✅ Test Application (lint, tests, build)
2. 🔄 Deploy to Cloud Run (build Docker, push to registry, deploy)
3. 🔄 Run Database Migrations
4. 🔄 Setup Demo Data (for staging/demo environments)
5. 🔄 Send Notification

## 🔍 Troubleshooting if Deployment Fails

### Common Issues and Solutions

#### 1. GitHub Secrets Missing
**Problem:** Workflow fails with authentication errors
**Solution:** Verify these secrets are set in GitHub:
- `GCP_PROJECT_ID`: servicehive-f009f
- `GCP_SA_KEY`: (entire contents of service account JSON)

#### 2. Docker Build Fails
**Problem:** Build step fails during containerization
**Solution:** Check Dockerfile.production and package.json
```bash
# Test build locally
docker build -f Dockerfile.production -t test-fence-platform .
```

#### 3. Cloud Run Deployment Fails  
**Problem:** Service won't start or deploy
**Solution:** Check Cloud Build logs
```bash
gcloud builds list --limit=5 --project=servicehive-f009f
gcloud builds logs [BUILD_ID] --project=servicehive-f009f
```

#### 4. Database Connection Issues
**Problem:** App can't connect to Cloud SQL
**Solution:** Verify database URLs and Cloud SQL proxy
```bash
# Test database connection
gcloud sql connect fence-platform-db --user=postgres --database=fence_platform
```

#### 5. Secret Access Issues
**Problem:** Can't access secrets from Cloud Run
**Solution:** Verify service account has secretmanager.secretAccessor role
```bash
gcloud projects get-iam-policy servicehive-f009f --flatten="bindings[].members" --filter="bindings.members:fence-platform-sa"
```

## 📱 Manual Deployment Trigger

If automatic deployment doesn't start, trigger manually:

### Option 1: GitHub UI
1. Go to https://github.com/webemo-aaron/fence-platform/actions
2. Click "Deploy to Google Cloud Platform"
3. Click "Run workflow"
4. Select environment (staging recommended first)
5. Click "Run workflow"

### Option 2: Push Another Commit
```bash
echo "Trigger deployment" >> README.md
git add README.md
git commit -m "trigger: Force deployment"
git push origin main
```

### Option 3: Manual gcloud Deployment
```bash
# Build and deploy manually if needed
gcloud builds submit --tag us-central1-docker.pkg.dev/servicehive-f009f/fence-platform/fence-platform:manual --project=servicehive-f009f

gcloud run deploy fence-platform \
  --image us-central1-docker.pkg.dev/servicehive-f009f/fence-platform/fence-platform:manual \
  --region us-central1 \
  --service-account fence-platform-sa@servicehive-f009f.iam.gserviceaccount.com \
  --set-secrets "DATABASE_URL=database-url-production:latest,JWT_SECRET=jwt-secret:latest" \
  --project=servicehive-f009f
```

## 🎯 Expected Deployment Results

### Services That Should Be Created
1. **fence-platform** (Production)
2. **fence-platform-staging** (Staging)  
3. **fence-platform-demo** (Demo with sample data)

### URLs Format
- Production: https://fence-platform-[HASH]-uc.a.run.app
- Staging: https://fence-platform-staging-[HASH]-uc.a.run.app
- Demo: https://fence-platform-demo-[HASH]-uc.a.run.app

### Health Check Verification
```bash
# Once deployed, test all endpoints
curl https://fence-platform-[HASH]-uc.a.run.app/health
curl https://fence-platform-staging-[HASH]-uc.a.run.app/health  
curl https://fence-platform-demo-[HASH]-uc.a.run.app/health
```

## 📞 Next Steps After Successful Deployment

1. **Document live URLs** in DEPLOYMENT_STATUS.md
2. **Test demo login** credentials
3. **Verify database migrations** completed
4. **Set up monitoring** alerts
5. **Configure custom domain** (optional)
6. **Share demo URLs** with stakeholders

---

**Status:** ⏳ Deployment in Progress  
**Started:** August 14, 2025  
**Monitor At:** https://github.com/webemo-aaron/fence-platform/actions