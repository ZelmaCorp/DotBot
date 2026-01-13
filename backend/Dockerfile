# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared libraries first (needed for file: dependencies)
COPY lib/ ./lib/

# Copy backend package files
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/

# Install backend dependencies (npm will resolve file:../lib/dotbot-core)
# Install all dependencies (including devDependencies) needed for TypeScript build
WORKDIR /app/backend
RUN npm ci

# Copy backend source
COPY backend/src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy shared libraries (needed at runtime)
COPY lib/ ./lib/

# Copy backend package files
COPY backend/package*.json ./backend/

# Install production dependencies only
WORKDIR /app/backend
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/backend/dist ./dist

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

# Start the server
CMD ["npm", "start"]
