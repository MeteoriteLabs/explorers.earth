# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Accept VITE_ variables as build args (these are baked into the JS bundle at build time)
ARG VITE_API_URL
ARG VITE_REST_API_URL
ARG VITE_PUBLIC_ACCESS_TOKEN
ARG VITE_CLARITY_PROJECT_ID
ARG VITE_LOCAL_TUNES_URL

ENV VITE_API_URL=$VITE_API_URL \
    VITE_REST_API_URL=$VITE_REST_API_URL \
    VITE_PUBLIC_ACCESS_TOKEN=$VITE_PUBLIC_ACCESS_TOKEN \
    VITE_CLARITY_PROJECT_ID=$VITE_CLARITY_PROJECT_ID \
    VITE_LOCAL_TUNES_URL=$VITE_LOCAL_TUNES_URL

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
# The build script runs generate-static + tsc + vite build
COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove the default Nginx placeholder config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config for SPA fallback routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
