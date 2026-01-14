# Frontend Dockerfile
FROM node:22-alpine as builder

# Set working directory
WORKDIR /app

# Copy shared libraries first (needed for file: dependencies)
COPY lib/ ./lib/

# Build dotbot-core library first (required by frontend)
# Use npm install instead of npm ci to handle file: dependencies and devDependencies
WORKDIR /app/lib/dotbot-core
RUN npm install && npm run build

# Copy frontend package files (reset WORKDIR first)
WORKDIR /app
COPY frontend/package*.json ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/craco.config.js ./frontend/
COPY frontend/public ./frontend/public

# Install frontend dependencies (npm will resolve file:../lib/dotbot-core)
# Use npm install instead of npm ci to handle file: dependencies in monorepo
WORKDIR /app/frontend
RUN npm install

# Copy frontend source code
COPY frontend/src ./src

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built app to nginx
COPY --from=builder /app/frontend/build /usr/share/nginx/html

# Create minimal nginx configuration for container
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Handle React Router
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
