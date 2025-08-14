# Terraform configuration for Invisible Fence Platform deployment on GCP

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    bucket = "servicehive-f009f-terraform-state"
    prefix = "invisible-fence-automation"
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Data sources
data "google_project" "project" {
  project_id = var.project_id
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "cloudbuild.googleapis.com",
    "run.googleapis.com",
    "container.googleapis.com",
    "containerregistry.googleapis.com",
    "artifactregistry.googleapis.com",
    "firebase.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "sqladmin.googleapis.com",
    "compute.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com"
  ])
  
  project = var.project_id
  service = each.value
  
  disable_dependent_services = true
  disable_on_destroy         = false
}

# Artifact Registry for container images
resource "google_artifact_registry_repository" "invisible_fence_repo" {
  provider      = google-beta
  location      = var.region
  repository_id = "invisible-fence-automation"
  description   = "Container registry for Invisible Fence automation platform"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# Cloud SQL instance for production database
resource "google_sql_database_instance" "invisible_fence_db" {
  name             = "invisible-fence-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  deletion_protection = var.environment == "production" ? true : false

  settings {
    tier = var.environment == "production" ? "db-g1-small" : "db-f1-micro"
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      location                       = var.region
      point_in_time_recovery_enabled = var.environment == "production"
      backup_retention_settings {
        retained_backups = var.environment == "production" ? 30 : 7
      }
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc_network.id
      require_ssl     = true
    }
    
    database_flags {
      name  = "log_statement"
      value = "all"
    }
    
    maintenance_window {
      day  = 7
      hour = 3
    }
  }

  depends_on = [
    google_project_service.apis,
    google_service_networking_connection.private_vpc_connection
  ]
}

# Database
resource "google_sql_database" "invisible_fence_database" {
  name     = "invisible_fence_automation"
  instance = google_sql_database_instance.invisible_fence_db.name
}

# Database user
resource "google_sql_user" "invisible_fence_user" {
  name     = "invisible_fence_app"
  instance = google_sql_database_instance.invisible_fence_db.name
  password = var.database_password
}

# VPC Network
resource "google_compute_network" "vpc_network" {
  name                    = "invisible-fence-vpc"
  auto_create_subnetworks = false
}

# Subnet
resource "google_compute_subnetwork" "subnet" {
  name          = "invisible-fence-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc_network.id
}

# Private IP allocation for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "invisible-fence-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
}

# VPC peering connection for Cloud SQL
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]

  depends_on = [google_project_service.apis]
}

# Secret Manager secrets
resource "google_secret_manager_secret" "firebase_service_account" {
  secret_id = "firebase-service-account-key"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "google_maps_api_key" {
  secret_id = "google-maps-api-key"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.apis]
}

# Secret versions (values should be added manually or via CI/CD)
resource "google_secret_manager_secret_version" "database_url_version" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${google_sql_user.invisible_fence_user.name}:${var.database_password}@${google_sql_database_instance.invisible_fence_db.private_ip_address}:5432/${google_sql_database.invisible_fence_database.name}"
}

# Cloud Run service
resource "google_cloud_run_service" "invisible_fence_service" {
  name     = "invisible-fence-automation"
  location = var.region

  template {
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"         = var.environment == "production" ? "100" : "10"
        "autoscaling.knative.dev/minScale"         = var.environment == "production" ? "1" : "0"
        "run.googleapis.com/cloudsql-instances"    = google_sql_database_instance.invisible_fence_db.connection_name
        "run.googleapis.com/execution-environment" = "gen2"
        "run.googleapis.com/vpc-access-connector"  = google_vpc_access_connector.connector.name
      }
    }
    
    spec {
      container_concurrency = var.environment == "production" ? 1000 : 100
      timeout_seconds       = 300
      
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.invisible_fence_repo.repository_id}/invisible-fence:latest"
        
        ports {
          container_port = 3333
        }
        
        resources {
          limits = {
            cpu    = var.environment == "production" ? "2" : "1"
            memory = var.environment == "production" ? "2Gi" : "1Gi"
          }
        }
        
        env {
          name  = "NODE_ENV"
          value = var.environment
        }
        
        env {
          name  = "PORT"
          value = "3333"
        }
        
        env {
          name  = "GOOGLE_CLOUD_PROJECT"
          value = var.project_id
        }
        
        env {
          name = "DATABASE_URL"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.database_url.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name = "FIREBASE_SERVICE_ACCOUNT_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.firebase_service_account.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name = "JWT_SECRET"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.jwt_secret.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name = "GOOGLE_MAPS_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.google_maps_api_key.secret_id
              key  = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.invisible_fence_repo
  ]
}

# VPC Access Connector for Cloud Run to access Cloud SQL
resource "google_vpc_access_connector" "connector" {
  provider = google-beta
  name     = "invisible-fence-vpc-connector"
  region   = var.region
  
  subnet {
    name = google_compute_subnetwork.subnet.name
  }
  
  machine_type   = "e2-micro"
  min_instances  = 2
  max_instances  = var.environment == "production" ? 10 : 3
  
  depends_on = [google_project_service.apis]
}

# IAM for Cloud Run service
resource "google_service_account" "cloud_run_service_account" {
  account_id   = "invisible-fence-service"
  display_name = "Invisible Fence Cloud Run Service Account"
  description  = "Service account for Invisible Fence Cloud Run service"
}

# Grant Cloud Run service account access to secrets
resource "google_secret_manager_secret_iam_member" "service_account_secret_access" {
  for_each = toset([
    google_secret_manager_secret.firebase_service_account.secret_id,
    google_secret_manager_secret.database_url.secret_id,
    google_secret_manager_secret.jwt_secret.secret_id,
    google_secret_manager_secret.google_maps_api_key.secret_id
  ])
  
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run_service_account.email}"
}

# Grant Cloud SQL client role to service account
resource "google_project_iam_member" "cloud_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run_service_account.email}"
}

# Update Cloud Run service to use service account
resource "google_cloud_run_service_iam_member" "run_invoker" {
  service  = google_cloud_run_service.invisible_fence_service.name
  location = google_cloud_run_service.invisible_fence_service.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Firebase project (assuming it's already created)
# You may need to manually configure Firebase Auth providers

# Cloud Build trigger for automated deployments
resource "google_cloudbuild_trigger" "deploy_trigger" {
  provider = google-beta
  name     = "invisible-fence-deploy"
  
  github {
    owner = var.github_owner
    name  = var.github_repo
    push {
      branch = var.environment == "production" ? "main" : "develop"
    }
  }
  
  build {
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.invisible_fence_repo.repository_id}/invisible-fence:$SHORT_SHA",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.invisible_fence_repo.repository_id}/invisible-fence:latest",
        "."
      ]
    }
    
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.invisible_fence_repo.repository_id}/invisible-fence:$SHORT_SHA"
      ]
    }
    
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.invisible_fence_repo.repository_id}/invisible-fence:latest"
      ]
    }
    
    step {
      name = "gcr.io/cloud-builders/gcloud"
      args = [
        "run", "deploy", "invisible-fence-automation",
        "--image", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.invisible_fence_repo.repository_id}/invisible-fence:$SHORT_SHA",
        "--region", var.region,
        "--platform", "managed",
        "--allow-unauthenticated"
      ]
    }
  }
  
  depends_on = [google_project_service.apis]
}

# Cloud Monitoring alerts
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "Invisible Fence - High Error Rate"
  combiner     = "OR"
  
  conditions {
    display_name = "Error rate above 5%"
    
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"invisible-fence-automation\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  
  notification_channels = []
  
  depends_on = [google_project_service.apis]
}

# Cloud Storage bucket for file uploads
resource "google_storage_bucket" "invisible_fence_uploads" {
  name     = "${var.project_id}-invisible-fence-uploads"
  location = var.region
  
  uniform_bucket_level_access = true
  
  versioning {
    enabled = true
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
  
  depends_on = [google_project_service.apis]
}