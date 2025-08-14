# Terraform variables for Invisible Fence Platform

variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "servicehive-f009f"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "environment" {
  description = "Environment (development, staging, production)"
  type        = string
  default     = "development"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "database_password" {
  description = "Password for the database user"
  type        = string
  sensitive   = true
}

variable "github_owner" {
  description = "GitHub repository owner"
  type        = string
  default     = "webemo-aaron"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "invisible-fence-automation"
}

variable "domain_name" {
  description = "Custom domain name for the application"
  type        = string
  default     = ""
}

variable "enable_monitoring" {
  description = "Enable monitoring and alerting"
  type        = bool
  default     = true
}

variable "enable_backup" {
  description = "Enable database backups"
  type        = bool
  default     = true
}

variable "max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "cpu_limit" {
  description = "CPU limit for Cloud Run instances"
  type        = string
  default     = "1"
}

variable "memory_limit" {
  description = "Memory limit for Cloud Run instances"
  type        = string
  default     = "1Gi"
}

variable "container_concurrency" {
  description = "Container concurrency for Cloud Run"
  type        = number
  default     = 100
}

variable "timeout_seconds" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

variable "database_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "database_backup_retention" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
}

variable "vpc_connector_machine_type" {
  description = "Machine type for VPC connector"
  type        = string
  default     = "e2-micro"
}

variable "vpc_connector_min_instances" {
  description = "Minimum instances for VPC connector"
  type        = number
  default     = 2
}

variable "vpc_connector_max_instances" {
  description = "Maximum instances for VPC connector"
  type        = number
  default     = 3
}

variable "enable_ssl" {
  description = "Enable SSL for Cloud SQL"
  type        = bool
  default     = true
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for resources"
  type        = bool
  default     = false
}

variable "notification_email" {
  description = "Email for monitoring notifications"
  type        = string
  default     = "admin@invisiblefence.demo"
}

variable "custom_labels" {
  description = "Custom labels to apply to resources"
  type        = map(string)
  default = {
    application = "invisible-fence-automation"
    team        = "webemo"
    managed-by  = "terraform"
  }
}

variable "allowed_ip_ranges" {
  description = "IP ranges allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Allow all by default, restrict in production
}

variable "firebase_project_id" {
  description = "Firebase project ID (if different from GCP project)"
  type        = string
  default     = ""
}

variable "google_maps_api_key" {
  description = "Google Maps API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "enable_cloud_armor" {
  description = "Enable Cloud Armor for DDoS protection"
  type        = bool
  default     = false
}

variable "enable_cdn" {
  description = "Enable Cloud CDN for static assets"
  type        = bool
  default     = false
}

variable "storage_bucket_lifecycle_age" {
  description = "Age in days after which objects are deleted from storage bucket"
  type        = number
  default     = 90
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 30
}

variable "enable_audit_logs" {
  description = "Enable audit logging"
  type        = bool
  default     = true
}

variable "database_flags" {
  description = "Additional database flags"
  type        = map(string)
  default = {
    log_statement                = "all"
    log_min_duration_statement   = "1000"
    shared_preload_libraries     = "pg_stat_statements"
  }
}

variable "secrets" {
  description = "Additional secrets to create in Secret Manager"
  type        = map(string)
  default     = {}
  sensitive   = true
}