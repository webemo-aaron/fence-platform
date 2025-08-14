# Microservices Deployment Configuration for GCP
# Enterprise Multi-Tenant Fence Platform

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
}

locals {
  # Service definitions with progression tiers
  services = {
    api-gateway = {
      port = 8080
      cpu = "1"
      memory = "1Gi"
      min_scale = 1
      max_scale = 10
      tier = "core"
    }
    auth-service = {
      port = 3001
      cpu = "0.5"
      memory = "512Mi"
      min_scale = 1
      max_scale = 5
      tier = "core"
    }
    customer-portal = {
      port = 3002
      cpu = "1"
      memory = "1Gi"
      min_scale = 0
      max_scale = 20
      tier = "essential"
    }
    crm-service = {
      port = 3003
      cpu = "0.5"
      memory = "512Mi"
      min_scale = 0
      max_scale = 10
      tier = "professional"
    }
    pricing-service = {
      port = 3004
      cpu = "1"
      memory = "1Gi"
      min_scale = 0
      max_scale = 15
      tier = "essential"
    }
    maps-service = {
      port = 3005
      cpu = "0.5"
      memory = "512Mi"
      min_scale = 0
      max_scale = 10
      tier = "professional"
    }
    workflow-service = {
      port = 3006
      cpu = "1"
      memory = "2Gi"
      min_scale = 0
      max_scale = 8
      tier = "enterprise"
    }
    notification-service = {
      port = 3007
      cpu = "0.5"
      memory = "512Mi"
      min_scale = 0
      max_scale = 12
      tier = "essential"
    }
    storage-service = {
      port = 3008
      cpu = "0.5"
      memory = "1Gi"
      min_scale = 0
      max_scale = 8
      tier = "professional"
    }
    frontend-service = {
      port = 8081
      cpu = "0.25"
      memory = "256Mi"
      min_scale = 1
      max_scale = 50
      tier = "core"
    }
  }
}

# Create Artifact Registry repositories for each service
resource "google_artifact_registry_repository" "service_repos" {
  for_each = local.services
  
  provider      = google-beta
  location      = var.region
  repository_id = "fence-${each.key}"
  description   = "Container registry for ${each.key}"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# Create Cloud Run services for each microservice
resource "google_cloud_run_v2_service" "microservices" {
  for_each = local.services
  
  name     = "fence-${each.key}"
  location = var.region

  template {
    # Dynamic scaling based on service tier
    scaling {
      min_instance_count = each.value.min_scale
      max_instance_count = each.value.max_scale
    }

    # VPC access for database connectivity
    vpc_access {
      connector = google_vpc_access_connector.connector.name
      egress    = "ALL_TRAFFIC"
    }

    # Service account for secrets access
    service_account = google_service_account.microservice_sa[each.key].email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.service_repos[each.key].repository_id}/${each.key}:latest"
      
      ports {
        container_port = each.value.port
      }

      resources {
        limits = {
          cpu    = each.value.cpu
          memory = each.value.memory
        }
        cpu_idle = true
        startup_cpu_boost = true
      }

      # Environment variables for service discovery
      env {
        name  = "SERVICE_NAME"
        value = each.key
      }

      env {
        name  = "PORT"
        value = tostring(each.value.port)
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      # Service discovery endpoints
      env {
        name  = "API_GATEWAY_URL"
        value = "https://${google_cloud_run_v2_service.microservices["api-gateway"].uri}"
      }

      env {
        name  = "AUTH_SERVICE_URL"
        value = "https://${google_cloud_run_v2_service.microservices["auth-service"].uri}"
      }

      # Database connection
      env {
        name = "DATABASE_URL"
        value_from {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      # JWT secret for inter-service authentication
      env {
        name = "JWT_SECRET"
        value_from {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      # Firebase service account key
      env {
        name = "FIREBASE_SERVICE_ACCOUNT_KEY"
        value_from {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_service_account.secret_id
            version = "latest"
          }
        }
      }

      # Google Maps API key (for maps service)
      dynamic "env" {
        for_each = each.key == "maps-service" ? [1] : []
        content {
          name = "GOOGLE_MAPS_API_KEY"
          value_from {
            secret_key_ref {
              secret  = google_secret_manager_secret.google_maps_api_key.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    percent = 100
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
  }

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.service_repos
  ]
}

# Service accounts for each microservice
resource "google_service_account" "microservice_sa" {
  for_each = local.services
  
  account_id   = "fence-${each.key}-sa"
  display_name = "Fence Platform ${each.key} Service Account"
  description  = "Service account for ${each.key} microservice"
}

# Grant IAM permissions to service accounts
resource "google_secret_manager_secret_iam_member" "microservice_secret_access" {
  for_each = local.services
  
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.microservice_sa[each.key].email}"
}

resource "google_secret_manager_secret_iam_member" "microservice_jwt_access" {
  for_each = local.services
  
  secret_id = google_secret_manager_secret.jwt_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.microservice_sa[each.key].email}"
}

resource "google_secret_manager_secret_iam_member" "microservice_firebase_access" {
  for_each = local.services
  
  secret_id = google_secret_manager_secret.firebase_service_account.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.microservice_sa[each.key].email}"
}

# Cloud SQL access for services that need it
resource "google_project_iam_member" "microservice_cloudsql_client" {
  for_each = {
    for k, v in local.services : k => v
    if contains(["auth-service", "crm-service", "pricing-service", "workflow-service"], k)
  }
  
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.microservice_sa[each.key].email}"
}

# Allow public access to frontend and API gateway
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  for_each = {
    for k, v in local.services : k => v
    if contains(["frontend-service", "api-gateway"], k)
  }
  
  name     = google_cloud_run_v2_service.microservices[each.key].name
  location = google_cloud_run_v2_service.microservices[each.key].location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Internal service-to-service access
resource "google_cloud_run_v2_service_iam_member" "inter_service_access" {
  for_each = {
    for pair in setproduct(keys(local.services), keys(local.services)) :
    "${pair[0]}-to-${pair[1]}" => {
      caller = pair[0]
      target = pair[1]
    }
    if pair[0] != pair[1] && !contains(["frontend-service"], pair[0])
  }
  
  name     = google_cloud_run_v2_service.microservices[each.value.target].name
  location = google_cloud_run_v2_service.microservices[each.value.target].location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.microservice_sa[each.value.caller].email}"
}

# Cloud Build triggers for each service
resource "google_cloudbuild_trigger" "service_triggers" {
  for_each = local.services
  
  provider = google-beta
  name     = "fence-${each.key}-deploy"
  
  github {
    owner = var.github_owner
    name  = var.github_repo
    push {
      branch = var.environment == "production" ? "main" : "develop"
    }
  }

  included_files = [
    "microservices/${each.key}/**",
    "services/**",
    "package.json"
  ]

  build {
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build",
        "-f", "microservices/${each.key}/Dockerfile",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.service_repos[each.key].repository_id}/${each.key}:$SHORT_SHA",
        "-t", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.service_repos[each.key].repository_id}/${each.key}:latest",
        "."
      ]
    }
    
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.service_repos[each.key].repository_id}/${each.key}:$SHORT_SHA"
      ]
    }
    
    step {
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.service_repos[each.key].repository_id}/${each.key}:latest"
      ]
    }
    
    step {
      name = "gcr.io/cloud-builders/gcloud"
      args = [
        "run", "services", "update", "fence-${each.key}",
        "--image", "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.service_repos[each.key].repository_id}/${each.key}:$SHORT_SHA",
        "--region", var.region,
        "--platform", "managed"
      ]
    }
  }
  
  depends_on = [google_project_service.apis]
}

# API Gateway configuration using Google API Gateway
resource "google_api_gateway_api" "fence_api" {
  provider = google-beta
  api_id   = "fence-platform-api"
  display_name = "Fence Platform API"

  depends_on = [google_project_service.apis]
}

resource "google_api_gateway_api_config" "fence_api_config" {
  provider      = google-beta
  api           = google_api_gateway_api.fence_api.api_id
  api_config_id = "fence-platform-config"

  openapi_documents {
    document {
      path = "openapi.yaml"
      contents = base64encode(templatefile("${path.module}/api-gateway-config.yaml", {
        project_id = var.project_id
        region     = var.region
        services   = local.services
      }))
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_api_gateway_gateway" "fence_gateway" {
  provider   = google-beta
  api_config = google_api_gateway_api_config.fence_api_config.id
  gateway_id = "fence-platform-gateway"
  region     = var.region

  depends_on = [google_project_service.apis]
}