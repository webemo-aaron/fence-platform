# Maps Service Dockerfile
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mapsservice -u 1001

# Copy package files
COPY package.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy maps service code
COPY src/ ./src/
COPY services/maps/ ./services/
COPY services/shared/ ./services/shared/

# Create directories
RUN mkdir -p logs cache && \
    chown -R mapsservice:nodejs /app

# Runtime tools
RUN apk add --no-cache dumb-init curl

# Environment
ENV NODE_ENV=production
ENV PORT=3003

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

# Non-root user
USER mapsservice

# Signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start service
CMD ["node", "src/maps-server.js"]