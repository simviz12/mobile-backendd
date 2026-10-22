# Multi-stage Dockerfile for Guardian Mobile Backend

# ================================
# Stage 1: Build & Dependencies
# ================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install system dependencies needed for compiling native packages (argon2, etc.)
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy full application source code
COPY . .

# Generate Prisma Client & compile TypeScript
RUN npx prisma generate
RUN npm run build

# Prune devDependencies for production image
RUN npm prune --production

# ================================
# Stage 2: Production Runtime
# ================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install minimal runtime dependencies
RUN apk add --no-cache dumb-init

# Create non-root system user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built application and pruned node_modules from builder
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma

USER appuser

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
