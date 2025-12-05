# ========================================
# Multi-stage Dockerfile for NestJS + Playwright
# Optimized for Render.com deployment
# ========================================

# ========================================
# Stage 1: Build
# ========================================
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL (required by Prisma 5+)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files first (better cache)
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ========================================
# Stage 2: Production
# ========================================
FROM node:20-slim AS production

# Install system dependencies for Playwright + OpenSSL for Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user BEFORE installing dependencies
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nestjs nestjs && \
    mkdir -p /home/nestjs/.cache && \
    chown -R nestjs:nodejs /home/nestjs

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only (--omit=dev is the modern way)
RUN npm ci --omit=dev

# Generate Prisma client
RUN npx prisma generate

# Install Playwright browsers (as root, before switching user)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium --with-deps && \
    chmod -R 755 /ms-playwright

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Set ownership of app directory
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Set HOME for Playwright and other tools
ENV HOME=/home/nestjs
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Run migrations and start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
