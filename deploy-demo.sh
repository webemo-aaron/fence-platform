#!/bin/bash

# =====================================================
# Fence Platform - Quick Demo Deployment Script
# Deploy in 5 minutes for customer feedback
# =====================================================

set -e  # Exit on error

echo "🚀 Fence Platform Demo Deployment"
echo "=================================="
echo ""

# Configuration
DOMAIN=${DOMAIN:-"fenceplatform.io"}
ADMIN_EMAIL=${ADMIN_EMAIL:-"admin@fenceplatform.io"}
DEPLOY_ENV=${DEPLOY_ENV:-"demo"}

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker is required but not installed.${NC}" >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo -e "${RED}Docker Compose is required but not installed.${NC}" >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo -e "${RED}Git is required but not installed.${NC}" >&2; exit 1; }

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# =====================================================
# OPTION 1: Local Demo (Fastest - 2 minutes)
# =====================================================

if [ "$1" == "local" ]; then
    echo "🏠 Starting LOCAL DEMO deployment..."
    echo ""
    
    # Create .env file
    cat > .env << EOF
# Demo Environment Configuration
NODE_ENV=demo
PORT=3333

# Database (using Docker PostgreSQL)
DATABASE_URL=postgresql://postgres:demopass123@localhost:5432/fence_demo
DB_PASSWORD=demopass123

# Security (demo values)
JWT_SECRET=demo-jwt-secret-change-in-production-minimum-32-chars
BCRYPT_ROUNDS=10

# Email (optional for demo)
EMAIL_SERVICE=console
EMAIL_FROM=Demo Platform <demo@fenceplatform.io>

# Demo Mode
DEMO_MODE=true
RESET_DAILY=true
EOF

    echo "📦 Starting services with Docker Compose..."
    docker-compose -f docker-compose.demo.yml up -d

    echo "⏳ Waiting for database to be ready..."
    sleep 10

    echo "🗄️ Running database migrations..."
    docker-compose exec -T app npm run migrate:postgres

    echo "🎭 Setting up demo data..."
    docker-compose exec -T app node scripts/demo-setup.js

    echo ""
    echo -e "${GREEN}✅ LOCAL DEMO READY!${NC}"
    echo ""
    echo "🌐 Access Points:"
    echo "  Main: http://localhost:3333"
    echo "  Demo: http://localhost:3333/?org=demo"
    echo ""
    echo "🔐 Demo Logins:"
    echo "  Email: demo@fenceplatform.io"
    echo "  Password: DemoPass123!"
    echo ""
    echo "📊 View logs: docker-compose logs -f app"
    echo "🛑 Stop demo: docker-compose down"
    
    exit 0
fi

# =====================================================
# OPTION 2: Cloud Demo (DigitalOcean - 5 minutes)
# =====================================================

if [ "$1" == "cloud" ]; then
    echo "☁️ Starting CLOUD DEMO deployment..."
    echo ""
    
    # Check for required environment variables
    if [ -z "$DO_TOKEN" ]; then
        echo -e "${RED}Please set DO_TOKEN environment variable${NC}"
        echo "Get token from: https://cloud.digitalocean.com/account/api/tokens"
        exit 1
    fi
    
    SERVER_NAME="fence-demo-$(date +%s)"
    
    echo "🖥️ Creating DigitalOcean droplet: $SERVER_NAME"
    
    # Create droplet
    SERVER_IP=$(doctl compute droplet create $SERVER_NAME \
        --image docker-20-04 \
        --size s-2vcpu-2gb \
        --region nyc1 \
        --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1) \
        --user-data-file cloud-init.yml \
        --wait \
        --format PublicIPv4 \
        --no-header)
    
    echo "✓ Server created: $SERVER_IP"
    
    echo "⏳ Waiting for server to be ready (2 minutes)..."
    sleep 120
    
    echo "📦 Deploying application..."
    ssh root@$SERVER_IP << 'ENDSSH'
        cd /opt
        git clone https://github.com/your-repo/fence-platform.git
        cd fence-platform/src/invisible-fence-automation
        
        # Create production .env
        cat > .env << 'EOF'
NODE_ENV=production
PORT=80
DATABASE_URL=postgresql://postgres:prodpass456@localhost:5432/fence_platform
JWT_SECRET=$(openssl rand -base64 32)
DEMO_MODE=true
EOF
        
        # Start services
        docker-compose -f docker-compose.production.yml up -d
        
        # Run migrations and demo setup
        sleep 10
        docker-compose exec -T app npm run migrate:postgres
        docker-compose exec -T app node scripts/demo-setup.js
ENDSSH
    
    echo ""
    echo -e "${GREEN}✅ CLOUD DEMO READY!${NC}"
    echo ""
    echo "🌐 Access Points:"
    echo "  Main: http://$SERVER_IP"
    echo "  Demo: http://demo.$SERVER_IP.nip.io"
    echo ""
    echo "🔐 Demo Logins:"
    echo "  Email: demo@fenceplatform.io"
    echo "  Password: DemoPass123!"
    echo ""
    echo "💰 Server Cost: ~$0.02/hour ($14/month)"
    echo "🗑️ Destroy server: doctl compute droplet delete $SERVER_NAME"
    
    exit 0
fi

# =====================================================
# OPTION 3: Instant Heroku Demo (3 minutes)
# =====================================================

if [ "$1" == "heroku" ]; then
    echo "🚀 Starting HEROKU DEMO deployment..."
    echo ""
    
    # Check Heroku CLI
    command -v heroku >/dev/null 2>&1 || { 
        echo -e "${RED}Heroku CLI required. Install from: https://devcenter.heroku.com/articles/heroku-cli${NC}"
        exit 1
    }
    
    APP_NAME="fence-demo-$(date +%s | tail -c 6)"
    
    echo "📦 Creating Heroku app: $APP_NAME"
    
    # Create Heroku app
    heroku create $APP_NAME --buildpack heroku/nodejs
    
    # Add PostgreSQL addon
    heroku addons:create heroku-postgresql:mini --app $APP_NAME
    
    # Set config vars
    heroku config:set \
        NODE_ENV=production \
        JWT_SECRET=$(openssl rand -base64 32) \
        DEMO_MODE=true \
        NPM_CONFIG_PRODUCTION=false \
        --app $APP_NAME
    
    # Deploy
    echo "📤 Deploying to Heroku..."
    git push heroku main
    
    # Run migrations
    heroku run npm run migrate:postgres --app $APP_NAME
    
    # Setup demo data
    heroku run node scripts/demo-setup.js --app $APP_NAME
    
    echo ""
    echo -e "${GREEN}✅ HEROKU DEMO READY!${NC}"
    echo ""
    echo "🌐 URL: https://$APP_NAME.herokuapp.com"
    echo ""
    echo "🔐 Demo Logins:"
    echo "  Email: demo@fenceplatform.io"
    echo "  Password: DemoPass123!"
    echo ""
    echo "📊 View logs: heroku logs --tail --app $APP_NAME"
    echo "🗑️ Destroy app: heroku apps:destroy $APP_NAME"
    
    exit 0
fi

# =====================================================
# OPTION 4: Docker-only (No install needed)
# =====================================================

if [ "$1" == "docker" ]; then
    echo "🐳 Starting DOCKER-ONLY demo..."
    echo ""
    
    # Pull and run pre-built image
    echo "📦 Pulling demo image..."
    docker pull fenceplatform/demo:latest 2>/dev/null || {
        echo "Building demo image locally..."
        docker build -t fenceplatform/demo:latest .
    }
    
    echo "🚀 Starting demo container..."
    docker run -d \
        --name fence-demo \
        -p 3333:3333 \
        -e DEMO_MODE=true \
        -e DATABASE_URL=sqlite:///data/demo.db \
        fenceplatform/demo:latest
    
    echo "⏳ Initializing demo data..."
    sleep 5
    docker exec fence-demo node scripts/demo-setup.js
    
    echo ""
    echo -e "${GREEN}✅ DOCKER DEMO READY!${NC}"
    echo ""
    echo "🌐 URL: http://localhost:3333"
    echo ""
    echo "🔐 Demo Login:"
    echo "  Email: demo@fenceplatform.io"
    echo "  Password: DemoPass123!"
    echo ""
    echo "🛑 Stop: docker stop fence-demo"
    echo "🗑️ Remove: docker rm fence-demo"
    
    exit 0
fi

# =====================================================
# DEFAULT: Show options
# =====================================================

echo "Please choose a deployment option:"
echo ""
echo "  ./deploy-demo.sh local   - Local demo (2 min, Docker required)"
echo "  ./deploy-demo.sh docker  - Docker-only (1 min, easiest)"
echo "  ./deploy-demo.sh cloud   - DigitalOcean demo (5 min, $0.02/hr)"
echo "  ./deploy-demo.sh heroku  - Heroku demo (3 min, free tier)"
echo ""
echo "Example:"
echo "  ./deploy-demo.sh local"
echo ""

# Create docker-compose.demo.yml if it doesn't exist
if [ ! -f "docker-compose.demo.yml" ]; then
    cat > docker-compose.demo.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: fence_demo
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: demopass123
    ports:
      - "5432:5432"
    volumes:
      - demo_postgres_data:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3333:3333"
    environment:
      NODE_ENV: demo
      PORT: 3333
      DATABASE_URL: postgresql://postgres:demopass123@postgres:5432/fence_demo
      JWT_SECRET: demo-jwt-secret-minimum-32-characters
      DEMO_MODE: "true"
    depends_on:
      - postgres
    volumes:
      - ./:/app
      - /app/node_modules
    command: npm start

volumes:
  demo_postgres_data:
EOF
    echo "✓ Created docker-compose.demo.yml"
fi

# Create simple Dockerfile if it doesn't exist
if [ ! -f "Dockerfile" ]; then
    cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create data directory
RUN mkdir -p data logs

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3333/health || exit 1

# Start application
CMD ["node", "server-multi-tenant.js"]
EOF
    echo "✓ Created Dockerfile"
fi

echo "Ready to deploy! Choose an option above."