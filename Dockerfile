# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS dev
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start development server
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 smartdine

# Copy built application
COPY --from=builder --chown=smartdine:nodejs /app/dist ./dist
COPY --from=deps --chown=smartdine:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=smartdine:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown smartdine:nodejs logs

USER smartdine

EXPOSE 5000

CMD ["node", "dist/index.js"]