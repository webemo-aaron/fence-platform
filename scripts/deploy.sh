#!/bin/bash

# Deployment script for Invisible Fence Platform
set -e

# Configuration
PROJECT_ID="servicehive-f009f"
REGION="us-central1"
SERVICE_NAME="invisible-fence-automation"
REPOSITORY="invisible-fence-automation"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v gcloud &> /dev/null; then
        log_error "gcloud CLI is required but not installed."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is required but not installed."
        exit 1
    fi
    
    if ! command -v terraform &> /dev/null; then
        log_warning "Terraform not found. Infrastructure deployment will be skipped."
    fi
    
    log_success "Dependencies check completed"
}

# Authenticate with Google Cloud
authenticate() {
    log_info "Authenticating with Google Cloud..."
    
    if [[ -z "${GOOGLE_APPLICATION_CREDENTIALS}" ]]; then
        log_info "Using default authentication"
        gcloud auth application-default login
    else
        log_info "Using service account key"
        gcloud auth activate-service-account --key-file="${GOOGLE_APPLICATION_CREDENTIALS}"
    fi
    
    gcloud config set project "${PROJECT_ID}"
    gcloud config set compute/region "${REGION}"
    
    log_success "Authentication completed"
}

# Build and push Docker image
build_and_push() {
    log_info "Building and pushing Docker image..."
    
    # Configure Docker for Artifact Registry
    gcloud auth configure-docker "${REGION}-docker.pkg.dev"
    
    # Get the current commit SHA
    COMMIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
    IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:${COMMIT_SHA}"
    LATEST_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:latest"
    
    log_info "Building image: ${IMAGE_TAG}"
    
    # Build the Docker image
    docker build -t "${IMAGE_TAG}" -t "${LATEST_TAG}" .
    
    # Push the images
    log_info "Pushing images to Artifact Registry..."
    docker push "${IMAGE_TAG}"
    docker push "${LATEST_TAG}"
    
    log_success "Docker image built and pushed successfully"
    
    # Export for use in deployment
    export IMAGE_URI="${IMAGE_TAG}"
}

# Deploy to Cloud Run
deploy_service() {
    log_info "Deploying to Cloud Run..."
    
    # Determine environment based on branch or parameter
    ENVIRONMENT=${1:-development}
    
    # Set environment-specific configuration
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        MAX_INSTANCES=100
        MIN_INSTANCES=1
        MEMORY="2Gi"
        CPU="2"
        CONCURRENCY=1000
    else
        MAX_INSTANCES=10
        MIN_INSTANCES=0
        MEMORY="1Gi"
        CPU="1"
        CONCURRENCY=100
    fi
    
    log_info "Deploying ${ENVIRONMENT} environment"
    
    # Deploy to Cloud Run
    gcloud run deploy "${SERVICE_NAME}" \
        --image "${IMAGE_URI}" \
        --platform managed \
        --region "${REGION}" \
        --allow-unauthenticated \
        --set-env-vars "NODE_ENV=${ENVIRONMENT}" \
        --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}" \
        --memory "${MEMORY}" \
        --cpu "${CPU}" \
        --concurrency "${CONCURRENCY}" \
        --timeout 300 \
        --max-instances "${MAX_INSTANCES}" \
        --min-instances "${MIN_INSTANCES}"
    
    # Get the service URL
    SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
        --region "${REGION}" \
        --format 'value(status.url)')
    
    log_success "Deployment completed successfully!"
    log_success "Service URL: ${SERVICE_URL}"
}

# Test the deployment
test_deployment() {
    log_info "Testing deployment..."
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
        --region "${REGION}" \
        --format 'value(status.url)')
    
    # Wait for service to be ready
    log_info "Waiting for service to be ready..."
    sleep 30
    
    # Test health endpoint
    if curl -f "${SERVICE_URL}/api/status" > /dev/null 2>&1; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        exit 1
    fi
    
    # Display service information
    echo ""
    echo "🎯 Invisible Fence Platform Deployed Successfully!"
    echo "=================================================="
    echo "🌐 Main Application: ${SERVICE_URL}"
    echo "🔗 ROI Calculator: ${SERVICE_URL}/"
    echo "🔗 CRM Dashboard: ${SERVICE_URL}/crm"
    echo "🔗 Quote Generator: ${SERVICE_URL}/quote"
    echo "🔗 Service Map: ${SERVICE_URL}/map"
    echo "🔗 Pricing Approvals: ${SERVICE_URL}/approvals"
    echo "🔗 Authentication: ${SERVICE_URL}/auth"
    echo "=================================================="
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    if [[ ! -d "terraform" ]]; then
        log_warning "Terraform directory not found. Skipping infrastructure deployment."
        return
    fi
    
    if ! command -v terraform &> /dev/null; then
        log_warning "Terraform not installed. Skipping infrastructure deployment."
        return
    fi
    
    log_info "Deploying infrastructure with Terraform..."
    
    cd terraform
    
    # Initialize Terraform
    terraform init
    
    # Plan the deployment
    log_info "Creating Terraform plan..."
    terraform plan -var="environment=${ENVIRONMENT:-development}"
    
    # Ask for confirmation in interactive mode
    if [[ -t 0 ]]; then
        read -p "Do you want to apply the Terraform plan? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Terraform deployment cancelled"
            cd ..
            return
        fi
    fi
    
    # Apply the plan
    terraform apply -auto-approve -var="environment=${ENVIRONMENT:-development}"
    
    cd ..
    log_success "Infrastructure deployment completed"
}

# Setup secrets
setup_secrets() {
    log_info "Setting up secrets in Secret Manager..."
    
    # Create secrets if they don't exist
    SECRETS=(
        "firebase-service-account-key"
        "database-url"
        "jwt-secret"
        "google-maps-api-key"
    )
    
    for secret in "${SECRETS[@]}"; do
        if ! gcloud secrets describe "${secret}" &> /dev/null; then
            log_info "Creating secret: ${secret}"
            gcloud secrets create "${secret}" --replication-policy="automatic"
        else
            log_info "Secret already exists: ${secret}"
        fi
    done
    
    log_warning "Please manually add secret values using:"
    log_warning "gcloud secrets versions add SECRET_NAME --data-file=path/to/file"
}

# Main execution
main() {
    echo "🚀 Invisible Fence Platform Deployment Script"
    echo "=============================================="
    
    # Parse command line arguments
    ENVIRONMENT="development"
    SKIP_INFRA=false
    SKIP_TESTS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment=*)
                ENVIRONMENT="${1#*=}"
                shift
                ;;
            --skip-infra)
                SKIP_INFRA=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --environment=ENV    Set deployment environment (development|production)"
                echo "  --skip-infra         Skip infrastructure deployment"
                echo "  --skip-tests         Skip deployment tests"
                echo "  --help               Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Execute deployment steps
    check_dependencies
    authenticate
    
    if [[ "${SKIP_INFRA}" != true ]]; then
        deploy_infrastructure
        setup_secrets
    fi
    
    build_and_push
    deploy_service "${ENVIRONMENT}"
    
    if [[ "${SKIP_TESTS}" != true ]]; then
        test_deployment
    fi
    
    log_success "Deployment completed successfully! 🎉"
}

# Run main function with all arguments
main "$@"