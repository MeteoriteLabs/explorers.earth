# ── Stage 1: Base with Puppeteer system dependencies ──────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install system libraries required by Puppeteer/Chromium
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Tell Puppeteer to use the system-installed Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ── Stage 2: Install all dependencies (including devDeps for the build) ────
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# ── Stage 3: Build ────────────────────────────────────────────────────────
FROM deps AS builder

# VITE_ vars must be available at build time — they are embedded into the
# frontend bundle by Vite. They come in as Docker build-args from CI/CD.
ARG VITE_API_URL
ARG VITE_REST_API_URL
ARG VITE_PUBLIC_ACCESS_TOKEN
ARG VITE_CLARITY_PROJECT_ID

ENV VITE_API_URL=$VITE_API_URL \
    VITE_REST_API_URL=$VITE_REST_API_URL \
    VITE_PUBLIC_ACCESS_TOKEN=$VITE_PUBLIC_ACCESS_TOKEN \
    VITE_CLARITY_PROJECT_ID=$VITE_CLARITY_PROJECT_ID

COPY . .

# Build produces:
#   dist/public  → static frontend (served by Express serveStatic())
#   dist/server  → compiled Node.js server (entry: dist/server/index.js)
RUN npm run build

# ── Stage 4: Production runner ────────────────────────────────────────────
FROM base AS runner

ENV NODE_ENV=production

# Install ONLY production dependencies (no devDeps, smaller image)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist

# Copy static public assets (favicons, apple-touch-icon, etc.) that Express
# serves directly from the filesystem via express.static('public')
COPY --from=builder /app/public ./public

# Config files needed at runtime
COPY package.json drizzle.config.ts ./

# Application listens on port 5000 (configurable via PORT env var)
EXPOSE 5000

# Healthcheck so Docker / Traefik knows when the service is healthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health 2>/dev/null || exit 1

CMD ["node", "dist/server/index.js"]