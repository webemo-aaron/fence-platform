# Multi-Tenant Fence Platform - Production Deployment Guide

## 🚀 Quick Deployment (15 Minutes)

### Prerequisites
- Linux server (Ubuntu 22.04 recommended)
- Domain name (e.g., fenceplatform.io)
- Docker & Docker Compose installed
- Stripe account (for payments)
- Email service credentials (Gmail, SendGrid, etc.)

## 📋 Step-by-Step Deployment

### 1. Server Setup (5 minutes)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Nginx (for reverse proxy)
sudo apt install nginx certbot python3-certbot-nginx -y
```

### 2. Clone and Configure (3 minutes)

```bash
# Clone repository
cd /opt
sudo git clone [your-repo-url] fence-platform
cd fence-platform/src/invisible-fence-automation

# Create environment file
cat > .env << 'EOF'
# Database
DB_PASSWORD=your-strong-password-here

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars

# Stripe
STRIPE_SECRET_KEY=sk_live_your-stripe-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Email (Gmail example)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Fence Platform <noreply@fenceplatform.io>

# Domain
DOMAIN=fenceplatform.io
EOF

# Set permissions
sudo chmod 600 .env
```

### 3. Configure Nginx (3 minutes)

```bash
# Create Nginx configuration
sudo cat > /etc/nginx/sites-available/fence-platform << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name *.fenceplatform.io fenceplatform.io;
    return 301 https://$host$request_uri;
}

# Main domain
server {
    listen 443 ssl http2;
    server_name fenceplatform.io;
    
    ssl_certificate /etc/letsencrypt/live/fenceplatform.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fenceplatform.io/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Wildcard subdomains
server {
    listen 443 ssl http2;
    server_name *.fenceplatform.io;
    
    ssl_certificate /etc/letsencrypt/live/fenceplatform.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fenceplatform.io/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # File upload limits
    client_max_body_size 10M;
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/fence-platform /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Setup SSL Certificate (2 minutes)

```bash
# Get wildcard SSL certificate
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.fenceplatform.io" -d "fenceplatform.io"

# Follow the DNS challenge instructions
# Add TXT records to your DNS provider

# Auto-renewal
sudo certbot renew --dry-run
```

### 5. Configure DNS

Add these DNS records to your domain:

```
Type  Name    Value               TTL
A     @       YOUR-SERVER-IP      300
A     *       YOUR-SERVER-IP      300
TXT   _acme   [certbot-value]     300  (temporary for SSL)
```

### 6. Deploy Application (2 minutes)

```bash
# Start with Docker Compose
cd /opt/fence-platform/src/invisible-fence-automation
sudo docker-compose -f docker-compose.production.yml up -d

# Check logs
sudo docker-compose -f docker-compose.production.yml logs -f

# Run database migration
sudo docker-compose -f docker-compose.production.yml exec app npm run migrate:postgres
```

## 🔧 Production Configuration

### Environment Variables

```bash
# Production .env file
NODE_ENV=production
PORT=3000

# Database (PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/fence_platform
DB_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=optional-redis-password

# Security
JWT_SECRET=minimum-32-character-random-string
BCRYPT_ROUNDS=12
SESSION_SECRET=another-random-string

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_GROWTH=price_xxx  
STRIPE_PRICE_ENTERPRISE=price_xxx

# Email (SendGrid recommended for production)
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@fenceplatform.io

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
NEW_RELIC_LICENSE_KEY=xxx

# Features
ENABLE_SIGNUPS=true
ENABLE_TRIALS=true
TRIAL_DAYS=14
REQUIRE_EMAIL_VERIFICATION=true
```

### Monitoring Setup

```bash
# Install monitoring
sudo apt install htop nethogs iotop -y

# Setup log rotation
sudo cat > /etc/logrotate.d/fence-platform << 'EOF'
/opt/fence-platform/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        docker-compose -f /opt/fence-platform/src/invisible-fence-automation/docker-compose.production.yml restart app
    endscript
}
EOF
```

### Backup Strategy

```bash
# Create backup script
sudo cat > /opt/fence-platform/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/fence-platform"
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose -f /opt/fence-platform/src/invisible-fence-automation/docker-compose.production.yml \
  exec -T postgres pg_dump -U postgres fence_platform > $BACKUP_DIR/db-$DATE.sql

# Compress
gzip $BACKUP_DIR/db-$DATE.sql

# Upload to S3 (optional)
# aws s3 cp $BACKUP_DIR/db-$DATE.sql.gz s3://your-backup-bucket/

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: db-$DATE.sql.gz"
EOF

# Make executable and schedule
sudo chmod +x /opt/fence-platform/backup.sh
sudo crontab -e
# Add: 0 2 * * * /opt/fence-platform/backup.sh
```

## 🚦 Health Checks

### Application Health

```bash
# Check application status
curl http://localhost:3000/health

# Check Docker containers
docker-compose -f docker-compose.production.yml ps

# Check database connection
docker-compose -f docker-compose.production.yml exec postgres pg_isready

# Check Redis
docker-compose -f docker-compose.production.yml exec redis redis-cli ping
```

### Monitoring Endpoints

- Health: `https://fenceplatform.io/health`
- Metrics: `https://admin.fenceplatform.io/api/admin/stats`
- Logs: `docker-compose logs -f app`

## 📊 Performance Optimization

### 1. Database Optimization

```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_customers_email ON customers(email);
CREATE INDEX CONCURRENTLY idx_quotes_created ON quote_history(created_at DESC);
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Analyze tables
ANALYZE customers;
ANALYZE quote_history;
ANALYZE organizations;
```

### 2. Redis Caching

```javascript
// Configure Redis in production
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
  }
});
```

### 3. CDN Setup (Optional)

```bash
# CloudFlare setup
# 1. Add domain to CloudFlare
# 2. Update DNS to CloudFlare nameservers
# 3. Enable SSL/TLS "Full (strict)"
# 4. Create page rules for caching
```

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Setup UFW firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2ban Setup

```bash
# Install fail2ban
sudo apt install fail2ban -y

# Configure for Nginx
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true

[nginx-noproxy]
enabled = true
EOF

sudo systemctl restart fail2ban
```

### 3. Security Headers

```nginx
# Add to Nginx configuration
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline';" always;
```

## 🚀 Launch Checklist

### Pre-Launch
- [ ] SSL certificate installed and working
- [ ] DNS configured with wildcard subdomain
- [ ] Stripe webhook configured
- [ ] Email service tested
- [ ] Backup system tested
- [ ] Monitoring configured

### Launch Day
- [ ] Run database migrations
- [ ] Create admin organization
- [ ] Test signup flow
- [ ] Test payment flow
- [ ] Monitor logs for errors
- [ ] Send launch announcement

### Post-Launch
- [ ] Monitor performance metrics
- [ ] Review security logs
- [ ] Collect user feedback
- [ ] Plan feature updates

## 📞 Support Procedures

### Common Issues

1. **Organization not found**
   ```bash
   # Check organization exists
   docker-compose exec postgres psql -U postgres -d fence_platform \
     -c "SELECT * FROM organizations WHERE subdomain = 'customer-subdomain';"
   ```

2. **Email not sending**
   ```bash
   # Test email configuration
   docker-compose exec app node -e "
   const nodemailer = require('nodemailer');
   // Test email code
   "
   ```

3. **Database connection issues**
   ```bash
   # Restart database
   docker-compose restart postgres
   # Check connections
   docker-compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
   ```

## 🎉 Success Metrics

Monitor these KPIs after launch:

- **Signups**: Target 10+ per week
- **Trial Conversion**: Target 30%+
- **Uptime**: Maintain 99.9%
- **Response Time**: < 200ms p95
- **Error Rate**: < 0.1%

## 📚 Additional Resources

- [PostgreSQL Tuning](https://pgtune.leopard.in.ua/)
- [Nginx Optimization](https://www.nginx.com/blog/tuning-nginx/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Stripe Integration](https://stripe.com/docs/webhooks)

---

**Emergency Contact**: If critical issues arise, contact:
- Technical: your-email@example.com
- Business: business@example.com
- Server Provider: Support ticket system

**Deployment Complete!** Your multi-tenant fence platform is now live at `https://fenceplatform.io` 🎊