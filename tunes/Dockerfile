FROM node:18-alpine AS base

# Set working directory here
WORKDIR /app

# Install dependencies for Puppeteer
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

# Tell Puppeteer to skip downloading Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Separate layer for dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Build the application
FROM deps AS builder

# Accept VITE_ build args - these are embedded into the frontend bundle at build time
ARG VITE_API_URL
ARG VITE_REST_API_URL
ARG VITE_PUBLIC_ACCESS_TOKEN

# Set them as ENV so Vite can read them during build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REST_API_URL=$VITE_REST_API_URL
ENV VITE_PUBLIC_ACCESS_TOKEN=$VITE_PUBLIC_ACCESS_TOKEN

COPY . .
RUN npm run build

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Copy production dependencies and build output
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copy necessary config files
COPY package.json ./
COPY drizzle.config.ts ./
COPY shared ./shared

# Expose application port
EXPOSE 5000

# Set the default command
CMD ["node", "dist/server/index.js"]
