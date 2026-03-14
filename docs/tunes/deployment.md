# tunes — Deployment

## Build Process

```bash
# Build for production
npm run build
# Runs: vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist/server

# Start production server
npm run start
# Runs: NODE_ENV=production node dist/server/index.js
```

The build produces:
- `dist/` — Vite-built frontend static assets
- `dist/server/index.js` — Bundled Express server (ESM format)

In production, Express serves the static frontend files and handles API/WebSocket connections from a single port (default: 5000).

## Docker

tunes includes Docker support for containerized deployment. See `tunes/docker-documentation.md` for the detailed Docker setup guide.

### Quick Docker Start

```bash
# Build and start with Docker Compose
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f

# Access application
# http://localhost:5000
```

### Dockerfile Overview

Multi-stage build:
1. **deps** — Install npm dependencies (`npm ci`)
2. **builder** — Build the application (`npm run build`)
3. **runner** — Production image with only built artifacts and production dependencies

### Docker Compose Services

| Service | Image | Purpose |
|---------|-------|---------|
| `app` | Custom build | tunes application (port 5000) |
| `db` | `postgres:15-alpine` | PostgreSQL database (port 5432) |

Both services run on a shared Docker network for internal communication.

## AWS Infrastructure

### Frontend Hosting
- **S3** bucket for static assets with website hosting enabled
- **CloudFront** CDN distribution for global edge caching
- **Route53** for DNS management
- **ACM** for SSL certificate management

### Backend Services
- **ECS Fargate** for containerized backend (serverless containers)
- **ECR** for Docker image registry
- **RDS PostgreSQL** for managed database
- **ElastiCache** for session caching (optional)
- **ALB** (Application Load Balancer) for traffic distribution

### Supporting Infrastructure
- **CloudWatch** for monitoring, logging, and alerting
- **SNS** for notifications
- **IAM** roles and policies for secure service access
- **VPC** with private subnets for network isolation

### Infrastructure as Code
Terraform is recommended for provisioning AWS resources:
- Modularize resources (networking, compute, database, CDN)
- Use S3 backend for Terraform state
- Maintain environment-specific configurations (staging, production)

## CI/CD Pipeline

### GitHub Actions

Set up `.github/workflows/ci.yml` for:
- TypeScript type checking (`npm run check`)
- ESLint code style validation
- Unit test execution
- Code coverage reporting

### Jenkins Pipeline

For production deployments:
1. **Checkout** — Pull latest code
2. **Dependencies** — `npm ci`
3. **Test** — Run type checks and tests
4. **Build** — `npm run build`
5. **Docker** — Build and push image to ECR
6. **Deploy** — Update ECS service or S3/CloudFront

Conditional deployment based on branch:
- `develop` → staging environment
- `main` → production environment

## Database Migrations in Production

1. **Pre-deployment**: Generate migration with `drizzle-kit push` on staging
2. **Test**: Validate migration on staging database
3. **Backup**: Snapshot production database before deployment
4. **Deploy**: Run migration as part of CI/CD pipeline
5. **Verify**: Check migration success before routing traffic
6. **Rollback**: Keep reversion scripts ready for each migration

## Monitoring

- **Application health**: Express health check endpoint
- **Database**: RDS monitoring via CloudWatch
- **WebSocket**: Socket.IO connection metrics
- **Error tracking**: Server-side logging
- **User analytics**: Microsoft Clarity (client-side)

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `staging` | Pre-production testing |
| `develop` | Active development |
| `feat/*` | Feature branches (from develop) |

## Environment-Specific Config

Use environment variables for all environment-specific configuration. Never hardcode URLs, secrets, or environment-dependent values. See [Environment Variables](../environment-variables.md).
