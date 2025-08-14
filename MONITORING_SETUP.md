# 📊 Fence Platform Monitoring & Operations

## 🔍 Health Check Endpoints

Once deployed, verify all services are healthy:

```bash
# Production health check
curl https://fence-platform-[HASH]-uc.a.run.app/health

# Staging health check  
curl https://fence-platform-staging-[HASH]-uc.a.run.app/health

# Demo health check
curl https://fence-platform-demo-[HASH]-uc.a.run.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-14T...",
  "environment": "production|staging|demo",
  "database": "connected",
  "version": "1.0.0"
}
```

## 📈 Google Cloud Monitoring

### View Service Metrics
1. Go to [Google Cloud Console](https://console.cloud.google.com/run?project=servicehive-f009f)
2. Click on each service to see:
   - Request count and latency
   - CPU and memory usage
   - Error rates
   - Instance counts

### Set Up Alerts
```bash
# Create uptime check for production
gcloud monitoring uptime-checks create fence-platform-health \
  --display-name="Fence Platform Production Health" \
  --uri="https://fence-platform-[HASH]-uc.a.run.app/health" \
  --project=servicehive-f009f

# Create alert policy for high error rate
gcloud alpha monitoring policies create \
  --display-name="Fence Platform High Error Rate" \
  --condition-display-name="Error Rate > 5%" \
  --project=servicehive-f009f
```

## 📋 Operational Commands

### View Logs
```bash
# Production logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=fence-platform" \
  --limit=50 --project=servicehive-f009f

# Stream live logs
gcloud alpha run services logs tail fence-platform --region=us-central1 --project=servicehive-f009f

# Error logs only
gcloud logging read "resource.type=cloud_run_revision AND severity>=ERROR" \
  --limit=20 --project=servicehive-f009f
```

### Service Management
```bash
# List all fence platform services
gcloud run services list --filter="metadata.name~fence-platform" --project=servicehive-f009f

# Update service configuration
gcloud run services update fence-platform \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --region=us-central1 \
  --project=servicehive-f009f

# Rollback if needed
gcloud run services update-traffic fence-platform \
  --to-revisions=fence-platform-00001-abc=100 \
  --region=us-central1 \
  --project=servicehive-f009f
```

### Database Operations
```bash
# Connect to production database
gcloud sql connect fence-platform-db --user=postgres --database=fence_platform --project=servicehive-f009f

# Check database performance
gcloud sql operations list --instance=fence-platform-db --project=servicehive-f009f

# Create backup
gcloud sql backups create --instance=fence-platform-db --project=servicehive-f009f

# View connection info
gcloud sql instances describe fence-platform-db --project=servicehive-f009f
```

## 🚨 Troubleshooting Guide

### Service Won't Start
1. Check Cloud Build logs:
   ```bash
   gcloud builds list --limit=5 --project=servicehive-f009f
   gcloud builds describe [BUILD_ID] --project=servicehive-f009f
   ```

2. Check service logs:
   ```bash
   gcloud run services logs read fence-platform --limit=100 --project=servicehive-f009f
   ```

3. Verify secrets are accessible:
   ```bash
   gcloud secrets list --project=servicehive-f009f
   gcloud secrets versions access latest --secret="database-url-production" --project=servicehive-f009f
   ```

### Database Connection Issues
1. Test connectivity:
   ```bash
   gcloud sql instances describe fence-platform-db --project=servicehive-f009f
   ```

2. Check authorized networks:
   ```bash
   gcloud sql instances patch fence-platform-db --authorized-networks=0.0.0.0/0 --project=servicehive-f009f
   ```

3. Reset user password if needed:
   ```bash
   gcloud sql users set-password postgres --instance=fence-platform-db --password=[NEW_PASSWORD] --project=servicehive-f009f
   ```

### Performance Issues
1. Scale up resources:
   ```bash
   gcloud run services update fence-platform \
     --memory=2Gi \
     --cpu=2 \
     --max-instances=10 \
     --region=us-central1 \
     --project=servicehive-f009f
   ```

2. Check database performance:
   ```bash
   gcloud sql instances patch fence-platform-db --tier=db-n1-standard-1 --project=servicehive-f009f
   ```

## 📊 Cost Monitoring

### Current Usage
```bash
# View billing info
gcloud billing accounts list
gcloud billing projects describe servicehive-f009f

# Resource usage by service
gcloud run services describe fence-platform --region=us-central1 --project=servicehive-f009f
```

### Cost Optimization
```bash
# Scale down staging/demo when not in use
gcloud run services update fence-platform-staging \
  --min-instances=0 \
  --region=us-central1 \
  --project=servicehive-f009f

# Stop non-production databases at night
gcloud sql instances patch fence-platform-staging-db \
  --activation-policy=NEVER \
  --project=servicehive-f009f
```

## 📞 Support Escalation

### Emergency Issues
1. Check GitHub Actions for failed deployments
2. Review Cloud Run service logs
3. Verify database connectivity
4. Check secret manager access

### Non-Emergency Issues
1. Review metrics in Cloud Console
2. Check application logs
3. Verify configuration settings
4. Test individual components

---

**Last Updated:** August 14, 2025
**Environment:** Multi-tenant Production Ready