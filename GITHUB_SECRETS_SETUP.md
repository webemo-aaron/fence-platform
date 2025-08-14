# GitHub Secrets Setup Instructions

## 🔐 Required GitHub Secrets

You need to add the following secrets to your GitHub repository for the deployment to work.

### Step-by-Step Instructions:

1. **Go to your GitHub repository:**
   https://github.com/webemo-aaron/fence-platform

2. **Navigate to Settings:**
   - Click on the "Settings" tab in your repository
   - In the left sidebar, click on "Secrets and variables"
   - Click on "Actions"

3. **Add the following secrets:**

### Secret 1: GCP_PROJECT_ID
- Click "New repository secret"
- Name: `GCP_PROJECT_ID`
- Value: `servicehive-f009f`
- Click "Add secret"

### Secret 2: GCP_SA_KEY
- Click "New repository secret"
- Name: `GCP_SA_KEY`
- Value: Copy the ENTIRE contents of the `gcp-sa-key.json` file (including the curly braces)
- Click "Add secret"

### Secret 3: DATABASE_URL (Optional for now)
- This will be added after the Cloud SQL instances are ready
- The format will be: `postgresql://postgres:PASSWORD@/fence_platform?host=/cloudsql/PROJECT:REGION:INSTANCE`

### Secret 4: SLACK_WEBHOOK (Optional)
- Only if you want Slack notifications for deployments
- Name: `SLACK_WEBHOOK`
- Value: Your Slack webhook URL

## 🚀 After Adding Secrets

Once you've added the secrets, you can trigger the deployment by:

1. Making a commit and pushing to the `main` branch
2. Or manually triggering the workflow from the Actions tab

## 📋 Verification Checklist

- [ ] GCP_PROJECT_ID secret added
- [ ] GCP_SA_KEY secret added (entire JSON contents)
- [ ] Deleted local gcp-sa-key.json file for security
- [ ] Ready to trigger deployment

## 🔒 Security Note

**IMPORTANT:** After adding the GCP_SA_KEY to GitHub, delete the local key file:
```bash
rm gcp-sa-key.json
```

## 🌐 Your Services URLs (once deployed)

After successful deployment, your services will be available at:
- Production: `https://fence-platform-xxxxx-uc.a.run.app`
- Staging: `https://fence-platform-staging-xxxxx-uc.a.run.app`
- Demo: `https://fence-platform-demo-xxxxx-uc.a.run.app`

Run `gcloud run services list` to see the actual URLs after deployment.