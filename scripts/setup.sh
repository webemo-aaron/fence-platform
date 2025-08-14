#!/bin/bash

# Setup script for Invisible Fence Platform
set -e

# Configuration
PROJECT_ID="servicehive-f009f"
REGION="us-central1"

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

# Check if running in WSL
check_wsl() {
    if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
        log_info "Running in WSL environment"
        export WSL_ENV=true
    else
        export WSL_ENV=false
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Install Node.js dependencies
    if [[ -f "package.json" ]]; then
        log_info "Installing Node.js dependencies..."
        npm install
        log_success "Node.js dependencies installed"
    fi
    
    # Check for required system tools
    REQUIRED_TOOLS=("node" "npm" "git")
    OPTIONAL_TOOLS=("gcloud" "docker" "terraform")
    
    log_info "Checking required tools..."
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        else
            log_info "✓ $tool found"
        fi
    done
    
    log_info "Checking optional tools..."
    for tool in "${OPTIONAL_TOOLS[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_warning "$tool not found (needed for deployment)"
        else
            log_info "✓ $tool found"
        fi
    done
}

# Setup Google Cloud
setup_gcloud() {
    if ! command -v gcloud &> /dev/null; then
        log_warning "gcloud CLI not found. Please install it from:"
        log_warning "https://cloud.google.com/sdk/docs/install"
        return
    fi
    
    log_info "Setting up Google Cloud configuration..."
    
    # Check if already authenticated
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 > /dev/null; then
        log_info "Already authenticated with Google Cloud"
    else
        log_info "Please authenticate with Google Cloud..."
        gcloud auth login
    fi
    
    # Set project
    gcloud config set project "${PROJECT_ID}"
    gcloud config set compute/region "${REGION}"
    
    # Enable required APIs
    log_info "Enabling required Google Cloud APIs..."
    REQUIRED_APIS=(
        "cloudbuild.googleapis.com"
        "run.googleapis.com"
        "artifactregistry.googleapis.com"
        "firebase.googleapis.com"
        "secretmanager.googleapis.com"
        "sqladmin.googleapis.com"
    )
    
    for api in "${REQUIRED_APIS[@]}"; do
        log_info "Enabling $api..."
        gcloud services enable "$api"
    done
    
    log_success "Google Cloud setup completed"
}

# Setup Firebase
setup_firebase() {
    log_info "Firebase setup instructions:"
    echo ""
    echo "🔥 Firebase Setup Required:"
    echo "1. Go to https://console.firebase.google.com/project/${PROJECT_ID}"
    echo "2. Enable Authentication"
    echo "3. Configure Google and Facebook sign-in providers"
    echo "4. Add your domain to authorized domains"
    echo "5. Download service account key and save as service-account-key.json"
    echo ""
    
    # Check if Firebase CLI is installed
    if command -v firebase &> /dev/null; then
        log_info "Firebase CLI found. You can run 'firebase login' to authenticate"
    else
        log_info "Install Firebase CLI: npm install -g firebase-tools"
    fi
}

# Setup environment files
setup_environment() {
    log_info "Setting up environment configuration..."
    
    # Copy example environment file
    if [[ ! -f ".env" ]]; then
        if [[ -f ".env.example" ]]; then
            cp .env.example .env
            log_info "Created .env file from .env.example"
            log_warning "Please edit .env file with your configuration"
        else
            log_warning ".env.example not found"
        fi
    else
        log_info ".env file already exists"
    fi
    
    # Create data directory
    mkdir -p data
    log_info "Created data directory"
}

# Initialize git repository
setup_git() {
    if [[ ! -d ".git" ]]; then
        log_info "Initializing git repository..."
        git init
        git config user.name "webemo-aaron"
        git config user.email "aaron@webemo.io"
        log_success "Git repository initialized"
    else
        log_info "Git repository already exists"
    fi
    
    # Add remote if not exists
    if ! git remote get-url origin &> /dev/null; then
        log_info "Add remote origin with:"
        log_info "git remote add origin https://github.com/webemo-aaron/invisible-fence-automation.git"
    fi
}

# Setup database
setup_database() {
    log_info "Setting up database..."
    
    # Create data directory if it doesn't exist
    mkdir -p data
    
    # Check if database exists
    if [[ ! -f "data/invisible-fence.db" ]]; then
        log_info "Database will be created on first run"
    else
        log_info "Database already exists"
    fi
    
    log_success "Database setup completed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    DIRECTORIES=(
        "data"
        "logs"
        "uploads"
        "backups"
    )
    
    for dir in "${DIRECTORIES[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    log_success "Directories created"
}

# Test local setup
test_setup() {
    log_info "Testing local setup..."
    
    # Test Node.js server start
    log_info "Testing server startup..."
    timeout 10s npm start > /dev/null 2>&1 &
    SERVER_PID=$!
    
    sleep 5
    
    if ps -p $SERVER_PID > /dev/null; then
        log_success "Server started successfully"
        kill $SERVER_PID 2>/dev/null || true
    else
        log_error "Server failed to start"
    fi
    
    # Test API endpoint
    if curl -f http://localhost:3333/api/status > /dev/null 2>&1; then
        log_success "API endpoint accessible"
    else
        log_warning "API endpoint not accessible (server may not be running)"
    fi
}

# Display next steps
show_next_steps() {
    echo ""
    echo "🎯 Setup Complete! Next Steps:"
    echo "==============================="
    echo ""
    echo "1. Configure environment:"
    echo "   - Edit .env file with your configuration"
    echo "   - Add Firebase service account key"
    echo ""
    echo "2. Setup Firebase:"
    echo "   - Enable Authentication providers"
    echo "   - Configure authorized domains"
    echo ""
    echo "3. Start development:"
    echo "   - npm start              # Start local server"
    echo "   - npm run dev            # Start with auto-reload"
    echo ""
    echo "4. Deploy to production:"
    echo "   - ./scripts/deploy.sh --environment=production"
    echo ""
    echo "5. Access the application:"
    echo "   - http://localhost:3333  # Local development"
    echo ""
    echo "📚 Documentation:"
    echo "   - README.md              # Getting started guide"
    echo "   - SYSTEM_COMPLETION_SUMMARY.md  # Complete feature overview"
    echo ""
}

# Main execution
main() {
    echo "🚀 Invisible Fence Platform Setup"
    echo "=================================="
    
    check_wsl
    install_dependencies
    create_directories
    setup_environment
    setup_git
    setup_database
    
    # Optional cloud setup
    if command -v gcloud &> /dev/null; then
        setup_gcloud
    else
        log_warning "Skipping Google Cloud setup (gcloud not installed)"
    fi
    
    setup_firebase
    
    # Test setup
    # test_setup
    
    show_next_steps
    
    log_success "Setup completed successfully! 🎉"
}

# Run main function
main "$@"