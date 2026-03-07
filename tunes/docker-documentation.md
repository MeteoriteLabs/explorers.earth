# Docker Deployment for Cosmic

## 🐳 Docker Deployment

### Prerequisites
- Docker ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose ([Install Docker Compose](https://docs.docker.com/compose/install/))

### Docker Configuration

1. **Create a Dockerfile in the project root**

```dockerfile
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Separate layer for dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build the application
FROM deps AS builder
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

# Expose application port
EXPOSE 5000

# Set the default command
CMD ["node", "dist/server/index.js"]
```

2. **Create a Docker Compose file**

```yaml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - SESSION_SECRET=${SESSION_SECRET}
      - COOKIE_SECRET=${COOKIE_SECRET}
      - EMAIL_HOST=${EMAIL_HOST}
      - EMAIL_PORT=${EMAIL_PORT}
      - EMAIL_USER=${EMAIL_USER}
      - EMAIL_PASS=${EMAIL_PASS}
      - EMAIL_FROM=${EMAIL_FROM}
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
      - CLARITY_PROJECT_ID=${CLARITY_PROJECT_ID}
    depends_on:
      - db
    restart: unless-stopped
    networks:
      - cosmic-network

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=${DB_USER:-cosmic}
      - POSTGRES_PASSWORD=${DB_PASS:-cosmicpass}
      - POSTGRES_DB=${DB_NAME:-cosmic}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - cosmic-network

networks:
  cosmic-network:
    driver: bridge

volumes:
  postgres-data:
```

3. **Create a .dockerignore file**

```
node_modules
npm-debug.log
.git
.github
.env
.env.example
.vscode
*.md
.gitignore
```

### Building and Running with Docker

1. **Build the Docker image**

```bash
# Build using Docker Compose
docker-compose build
```

2. **Run the application with Docker Compose**

```bash
# Create a .env file with your environment variables first
cp .env.example .env
# Edit .env with your values

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

3. **Access the Dockerized application**
   - Application: `http://localhost:5000`

### Docker in Production

For production deployments, consider the following best practices:

1. **Use Docker Swarm or Kubernetes**
   - For improved scalability and high availability
   - Configure resource limits and health checks

2. **Implement Container Orchestration**
   - Deploy multiple instances behind a load balancer
   - Configure auto-scaling based on load

3. **Container Security**
   - Use non-root users in containers
   - Scan images for vulnerabilities with tools like Trivy
   - Implement proper secret management

4. **Database Considerations**
   - Use a managed database service in production
   - Implement proper backup strategies
   - Set up database replication

5. **CI/CD Integration**
   - Build and test Docker images in CI pipeline
   - Push to container registry (ECR, Docker Hub)
   - Deploy using automated workflows