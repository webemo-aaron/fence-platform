# Multi-stage Dockerfile for Invisible Fence Platform

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S invisible-fence -u 1001

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy node_modules from builder stage
COPY --from=builder --chown=invisible-fence:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=invisible-fence:nodejs . .

# Create necessary directories
RUN mkdir -p data logs && \
    chown -R invisible-fence:nodejs data logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3333
ENV DATABASE_PATH=/app/data/invisible-fence.db

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3333/api/status || exit 1

# Switch to non-root user
USER invisible-fence

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]