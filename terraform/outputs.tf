# Terraform outputs for Invisible Fence Platform

output "cloud_run_service_url" {
  description = "URL of the deployed Cloud Run service"
  value       = google_cloud_run_service.invisible_fence_service.status[0].url
}

output "cloud_run_service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_service.invisible_fence_service.name
}

output "database_connection_name" {
  description = "Cloud SQL instance connection name"
  value       = google_sql_database_instance.invisible_fence_db.connection_name
}

output "database_private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.invisible_fence_db.private_ip_address
  sensitive   = true
}

output "database_name" {
  description = "Name of the database"
  value       = google_sql_database.invisible_fence_database.name
}

output "database_user" {
  description = "Database user name"
  value       = google_sql_user.invisible_fence_user.name
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository for container images"
  value       = google_artifact_registry_repository.invisible_fence_repo.name
}

output "artifact_registry_repository_url" {
  description = "URL of the Artifact Registry repository"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.invisible_fence_repo.repository_id}"
}

output "vpc_network_name" {
  description = "Name of the VPC network"
  value       = google_compute_network.vpc_network.name
}

output "vpc_network_id" {
  description = "ID of the VPC network"
  value       = google_compute_network.vpc_network.id
}

output "subnet_name" {
  description = "Name of the subnet"
  value       = google_compute_subnetwork.subnet.name
}

output "subnet_cidr" {
  description = "CIDR range of the subnet"
  value       = google_compute_subnetwork.subnet.ip_cidr_range
}

output "vpc_connector_name" {
  description = "Name of the VPC Access Connector"
  value       = google_vpc_access_connector.connector.name
}

output "service_account_email" {
  description = "Email of the Cloud Run service account"
  value       = google_service_account.cloud_run_service_account.email
}

output "secret_manager_secrets" {
  description = "List of Secret Manager secret names"
  value = [
    google_secret_manager_secret.firebase_service_account.secret_id,
    google_secret_manager_secret.database_url.secret_id,
    google_secret_manager_secret.jwt_secret.secret_id,
    google_secret_manager_secret.google_maps_api_key.secret_id
  ]
}

output "storage_bucket_name" {
  description = "Name of the Cloud Storage bucket"
  value       = google_storage_bucket.invisible_fence_uploads.name
}

output "storage_bucket_url" {
  description = "URL of the Cloud Storage bucket"
  value       = google_storage_bucket.invisible_fence_uploads.url
}

output "cloud_build_trigger_name" {
  description = "Name of the Cloud Build trigger"
  value       = google_cloudbuild_trigger.deploy_trigger.name
}

output "monitoring_alert_policy_name" {
  description = "Name of the monitoring alert policy"
  value       = google_monitoring_alert_policy.high_error_rate.display_name
}

output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}

output "environment" {
  description = "Environment"
  value       = var.environment
}

# Deployment information
output "deployment_info" {
  description = "Complete deployment information"
  value = {
    application_url         = google_cloud_run_service.invisible_fence_service.status[0].url
    environment            = var.environment
    project_id             = var.project_id
    region                 = var.region
    database_connection    = google_sql_database_instance.invisible_fence_db.connection_name
    container_registry     = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.invisible_fence_repo.repository_id}"
    service_account        = google_service_account.cloud_run_service_account.email
    vpc_network           = google_compute_network.vpc_network.name
    storage_bucket        = google_storage_bucket.invisible_fence_uploads.name
  }
}

# Instructions for manual setup
output "manual_setup_instructions" {
  description = "Instructions for completing the setup"
  value = <<-EOT
    
    🎯 Invisible Fence Platform Deployment Complete!
    
    Next steps to complete the setup:
    
    1. Configure Firebase Authentication:
       - Go to https://console.firebase.google.com/project/${var.project_id}/authentication
       - Enable Google and Facebook sign-in providers
       - Add your domain to authorized domains
    
    2. Add secrets to Secret Manager:
       - Firebase service account key: gcloud secrets versions add firebase-service-account-key --data-file=service-account-key.json
       - JWT secret: gcloud secrets versions add jwt-secret --data="your-random-jwt-secret"
       - Google Maps API key: gcloud secrets versions add google-maps-api-key --data="your-maps-api-key"
    
    3. Deploy the application:
       - Push your code to GitHub repository: ${var.github_owner}/${var.github_repo}
       - The Cloud Build trigger will automatically deploy on push to main/develop branch
    
    4. Custom domain (optional):
       - Map your domain to: ${google_cloud_run_service.invisible_fence_service.status[0].url}
    
    5. Test the deployment:
       - Visit: ${google_cloud_run_service.invisible_fence_service.status[0].url}
       - Check logs: gcloud logging read "resource.type=cloud_run_revision"
    
    Application URLs:
    - Main App: ${google_cloud_run_service.invisible_fence_service.status[0].url}
    - Auth: ${google_cloud_run_service.invisible_fence_service.status[0].url}/auth.html
    - CRM: ${google_cloud_run_service.invisible_fence_service.status[0].url}/crm
    - Quotes: ${google_cloud_run_service.invisible_fence_service.status[0].url}/quote
    - Maps: ${google_cloud_run_service.invisible_fence_service.status[0].url}/map
    - Approvals: ${google_cloud_run_service.invisible_fence_service.status[0].url}/approvals
    
  EOT
}

# Resource summary
output "resource_summary" {
  description = "Summary of created resources"
  value = {
    cloud_run_services    = 1
    sql_instances        = 1
    sql_databases       = 1
    sql_users           = 1
    vpc_networks        = 1
    subnets             = 1
    vpc_connectors      = 1
    service_accounts    = 1
    secrets             = 4
    storage_buckets     = 1
    build_triggers      = 1
    alert_policies      = 1
    enabled_apis        = 12
  }
}