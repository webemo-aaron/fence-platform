# Frontend Service Dockerfile - Static file server with Nginx
FROM nginx:1.25-alpine

# Copy static assets
COPY ui/ /usr/share/nginx/html/

# Copy nginx configuration
COPY microservices/frontend-service/nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN adduser -D -S -h /var/cache/nginx -s /sbin/nologin -G nginx nginxuser

# Set ownership
RUN chown -R nginxuser:nginx /usr/share/nginx/html && \
    chown -R nginxuser:nginx /var/cache/nginx && \
    chown -R nginxuser:nginx /var/log/nginx && \
    chown -R nginxuser:nginx /etc/nginx/conf.d

# Make nginx run as non-root
RUN touch /var/run/nginx.pid && \
    chown -R nginxuser:nginx /var/run/nginx.pid

# Environment
ENV PORT=8081

# Expose port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/ || exit 1

# Switch to non-root user
USER nginxuser

# Start nginx
CMD ["nginx", "-g", "daemon off;"]