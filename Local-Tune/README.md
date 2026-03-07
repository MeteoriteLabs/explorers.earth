# Cosmic - Collaborative Playlist Management Platform

Cosmic is an advanced collaborative playlist management platform that transforms music sharing across diverse social and venue settings, creating immersive and interactive music experiences. The platform features responsive design, persistent user sessions, advanced music control capabilities with YouTube integration, and comprehensive administrative tools.

## 🌟 Features

- **Real-time Playlist Management**
  - Live song queue updates via WebSocket
  - Currently playing status with YouTube integration
  - Play history tracking with timestamps
  - Drag-and-drop playlist reordering
  - Multiple playlist support with sharing capabilities
  - Cross-device synchronization

- **Guest Interaction**
  - Song request system with moderation
  - Custom venue branding and theming
  - QR code access for easy joining
  - Play on guest device with synced controls
  - Shared playlist visibility controls
  - Real-time playlist updates for guests
  - Guest activity analytics and tracking

- **Venue Management**
  - Customizable venue profiles and branding
  - Feature toggles (song requests, guest play, playlist sharing)
  - Session analytics and tracking
  - Playlist history with filtering
  - Analytics dashboard with usage metrics
  - Account management system

- **Security & Authentication**
  - Role-based access control (admin, venue owner, staff, guest)
  - Secure session management with PostgreSQL
  - Enhanced cookie-based authentication with 7-day persistence
  - Protected guest URLs with expiration
  - Rate limiting on API endpoints
  - CORS-enabled API with secure credentials handling
  - Email verification system
  - OTP (One-Time Password) authentication

- **Administrative Tools**
  - User management console
  - System health monitoring
  - Usage statistics and reporting
  - Account manager assignment
  - Regional performance analytics

## 🛠️ Tech Stack

- **Frontend**
  - React 18 + TypeScript
  - TanStack Query v5 for state management
  - shadcn/ui components with Tailwind CSS
  - Socket.IO client for real-time updates
  - YouTube IFrame Player API integration
  - Marquee text component for long titles
  - Optimized responsive layout with adaptive navigation
  - Microsoft Clarity for user behavior analytics

- **Backend**
  - Express.js server with TypeScript
  - Socket.IO for WebSocket communication
  - PostgreSQL + Drizzle ORM
  - Session-based auth with Passport.js
  - Email verification system
  - OTP authentication flow

- **APIs & Services**
  - YouTube Data API v3 for song search
  - Custom WebSocket protocol for real-time updates
  - QR code generation for venue access
  - Email delivery service for verification

## 📊 Database Schema

```typescript
// User & Authentication
interface User {
  id: number;
  username: string;
  email: string | null;
  password: string;
  otp: string | null;
  otpExpiry: Date | null;
  emailVerificationToken: string | null;
  emailVerificationExpiry: Date | null;
  isEmailVerified: boolean;
  guestUrl: string;
  venueName: string;
  theme: {
    primary: string;
    variant: 'professional' | 'tint' | 'vibrant';
    appearance: 'light' | 'dark' | 'system';
    radius: number;
  };
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
  accountManagerId: number | null;
}

// Account Manager
interface AccountManager {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  region: string | null;
}

// Playlist & Songs
interface Playlist {
  id: number;
  userId: number;
  name: string;
  isDefault: boolean;
  isVisibleToGuests: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Song {
  id: number;
  playlistId: number;
  youtubeId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
  position: number;
  addedBy: string;
  addedById: number | null;
  addedAt: Date;
}

// Play History
interface PlayHistory {
  id: number;
  userId: number;
  youtubeId: string;
  title: string;
  artist: string;
  playedAt: Date;
}

// Guest Sessions
interface GuestSession {
  id: number;
  userId: number; // Host user ID
  guestName: string | null;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  createdAt: Date;
  lastActive: Date | null;
}

// System Settings
interface SystemSettings {
  id: number;
  key: string;
  value: string;
  updatedAt: Date;
}

// User Sessions
interface Session {
  sid: string;
  sess: {
    cookie: {
      originalMaxAge: number;
      expires: Date;
      secure: boolean;
      httpOnly: boolean;
      path: string;
      sameSite: string;
    };
    passport: {
      user: number;
    };
  };
  expire: Date;
}

// API Usage Tracking
interface ApiUsage {
  id: number;
  userId: number | null;
  endpoint: string;
  timestamp: Date;
  responseTime: number;
  statusCode: number;
  ipAddress: string;
  userAgent: string;
}
```

## 🔌 WebSocket Events

### Client -> Server Events

```typescript
// Playlist Management
interface PlaylistEvent {
  type: 'PLAYLIST_UPDATE';
  payload: {
    playlistId: number;
    songId: number;
    action: 'add' | 'remove' | 'move' | 'play' | 'skip';
    position?: number;
  };
}

// Feature Toggles
interface FeatureToggleEvent {
  type: 'FEATURE_TOGGLE';
  payload: {
    feature: 'songRequests' | 'guestPlay' | 'playlistSharing' | 'recentlyPlayedVisibility';
    enabled: boolean;
  };
}

// Player State
interface PlayerStateEvent {
  type: 'PLAYER_STATE';
  payload: {
    action: 'play' | 'pause' | 'seek' | 'stop';
    position?: number;
    youtubeId?: string;
  };
}

// Guest Interaction
interface GuestEvent {
  type: 'GUEST_ACTION';
  payload: {
    action: 'request_song' | 'join' | 'leave';
    songData?: {
      youtubeId: string;
      title: string;
      artist: string;
      thumbnailUrl: string;
      duration: number;
    };
    guestInfo?: {
      name: string;
      deviceInfo: string;
    };
  };
}
```

### Server -> Client Events

```typescript
// Playlist State
interface PlaylistStateEvent {
  type: 'PLAYLIST_STATE';
  payload: {
    playlists: Array<{
      id: number;
      name: string;
      isDefault: boolean;
      isVisibleToGuests: boolean;
      songs: Array<{
        id: number;
        youtubeId: string;
        title: string;
        artist: string;
        thumbnailUrl: string;
        duration: number;
        position: number;
        addedBy: string;
      }>;
    }>;
    currentlyPlaying: {
      playlistId: number;
      songId: number;
      youtubeId: string;
      title: string;
      artist: string;
      position: number;
      currentTime: number;
    } | null;
    playHistory: Array<{
      youtubeId: string;
      title: string;
      artist: string;
      playedAt: string;
    }>;
  };
}

// Player Updates
interface PlayerUpdateEvent {
  type: 'PLAYER_UPDATE';
  payload: {
    status: 'playing' | 'paused' | 'ended' | 'buffering' | 'error';
    currentTime: number;
    duration: number;
    youtubeId: string | null;
    playlistId: number | null;
    songId: number | null;
  };
}

// Feature States
interface FeatureStateEvent {
  type: 'FEATURE_STATE';
  payload: {
    songRequests: boolean;
    guestPlay: boolean;
    playlistSharing: boolean;
    recentlyPlayedVisibility: boolean;
  };
}

// Guest Activity
interface GuestActivityEvent {
  type: 'GUEST_ACTIVITY';
  payload: {
    guestCount: number;
    recentActivity: Array<{
      action: 'join' | 'leave' | 'request_song';
      guestName: string | null;
      timestamp: string;
      details?: string;
    }>;
  };
}
```

## 📝 API Documentation

### Authentication

```typescript
// Register new venue
POST /api/auth/register
Body: {
  username: string;
  email: string;
  password: string;
  venueName: string;
}

// Login
POST /api/auth/login
Body: {
  username: string;
  password: string;
}

// Request password reset
POST /api/auth/forgot-password
Body: {
  email: string;
}

// Verify email
POST /api/auth/verify-email
Body: {
  token: string;
}

// Get current user
GET /api/user
Response: {
  id: number;
  username: string;
  email: string;
  venueName: string;
  isEmailVerified: boolean;
  guestUrl: string;
  settings: {
    theme: ThemeSettings;
    allowSongRequests: boolean;
    allowGuestPlayOnDevice: boolean;
    allowPlaylistSharing: boolean;
    allowRecentlyPlayedVisibility: boolean;
  };
}

// Update user settings
PATCH /api/user/settings
Body: {
  theme: ThemeSettings;
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
}
```

### Playlist Management

```typescript
// Get all playlists
GET /api/playlists
Response: {
  playlists: Array<{
    id: number;
    name: string;
    isDefault: boolean;
    isVisibleToGuests: boolean;
    songCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

// Create new playlist
POST /api/playlists
Body: {
  name: string;
  isVisibleToGuests: boolean;
}

// Get playlist details with songs
GET /api/playlists/:playlistId
Response: {
  id: number;
  name: string;
  isDefault: boolean;
  isVisibleToGuests: boolean;
  songs: Array<{
    id: number;
    youtubeId: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    duration: number;
    position: number;
    addedBy: string;
    addedAt: string;
  }>;
}

// Update playlist
PATCH /api/playlists/:playlistId
Body: {
  name?: string;
  isVisibleToGuests?: boolean;
}

// Delete playlist
DELETE /api/playlists/:playlistId

// Add song to playlist
POST /api/playlists/:playlistId/songs
Body: {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}

// Update song position
PATCH /api/playlists/:playlistId/songs/:songId
Body: {
  position: number;
}

// Remove song
DELETE /api/playlists/:playlistId/songs/:songId

// Get play history
GET /api/history
Query: {
  from?: string; // ISO date
  to?: string; // ISO date
  limit?: number;
  offset?: number;
}
```

### Guest Access

```typescript
// Get guest view URL
GET /api/guest/url
Response: {
  url: string;
}

// Regenerate guest URL
POST /api/guest/url/regenerate
Response: {
  url: string;
}

// Get guest visible playlists
GET /api/guest/:guestUrl/playlists
Response: {
  playlists: Array<{
    id: number;
    name: string;
    songs: Array<{
      id: number;
      youtubeId: string;
      title: string;
      artist: string;
      thumbnailUrl: string;
      duration: number;
      position: number;
    }>;
  }>;
  currentlyPlaying: {
    playlistId: number;
    songId: number;
    youtubeId: string;
    title: string;
    artist: string;
    position: number;
    currentTime: number;
  } | null;
  settings: {
    allowSongRequests: boolean;
    allowGuestPlayOnDevice: boolean;
    recentlyPlayed: Array<{
      youtubeId: string;
      title: string;
      artist: string;
      playedAt: string;
    }> | null;
  };
}

// Submit guest song request
POST /api/guest/:guestUrl/request
Body: {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}
```

### Admin API

```typescript
// Get all users
GET /api/admin/users
Response: {
  users: Array<{
    id: number;
    username: string;
    email: string;
    venueName: string;
    isEmailVerified: boolean;
    createdAt: string;
    lastActive: string | null;
    accountManager: string | null;
  }>;
}

// Get user details
GET /api/admin/user/:userId
Response: {
  user: {
    id: number;
    username: string;
    email: string;
    venueName: string;
    isEmailVerified: boolean;
    createdAt: string;
    guestUrl: string;
    settings: UserSettings;
    accountManagerId: number | null;
  };
  activity: {
    totalSongs: number;
    lastActive: string | null;
    sessions: Array<{
      createdAt: string;
      lastActive: string | null;
      browser: string;
      os: string;
      device: string;
    }>;
  };
  playlists: Array<{
    id: number;
    name: string;
    songCount: number;
    isDefault: boolean;
    isVisibleToGuests: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

// Update user account manager
PATCH /api/admin/user/:userId/account-manager
Body: {
  accountManagerId: number | null;
}

// Get account managers
GET /api/admin/account-managers
Response: {
  accountManagers: Array<{
    id: number;
    name: string;
    email: string;
    phone: string | null;
    region: string | null;
    userCount: number;
  }>;
}

// Get platform statistics
GET /api/admin/statistics
Response: {
  users: {
    total: number;
    active: number;
  };
  playlists: {
    total: number;
    avgPerUser: number;
  };
  songs: {
    total: number;
    avgPerPlaylist: number;
  };
  guests: {
    total: number;
    active: number;
  };
  songRequests: {
    total: number;
    yesterday: number;
    thisWeek: number;
  };
  peakHours: string;
  avgSessionDuration: string;
  regionalStats: Record<string, {
    hostCount: number;
    guestCount: number;
    songRequestCount: number;
  }>;
}
```
## 🚀 Development Setup

### Prerequisites

1. Node.js 18+ ([Download](https://nodejs.org/))
2. PostgreSQL 15+ ([Download](https://www.postgresql.org/download/))
3. YouTube Data API key ([Get API Key](https://console.cloud.google.com/))

## 🔧 Troubleshooting Guide

### Regional Statistics Map Display Issue

**Issue**: The Admin Dashboard global distribution map may show fewer venues than the total count indicated.

**Root Cause**: Only users with valid country codes in the `user_sessions` table appear on the map. Users without session data or without a country code in their sessions won't be displayed, leading to a discrepancy between the total user count and the users displayed on the map.

**Solution**: In the `getUserStats` method, we implemented a comprehensive approach to handle all users:

1. Initialize all users to the "Unknown" region by default
2. Process users with known country codes into their respective regions
3. Maintain a tracking system to avoid double-counting users in multiple regions
4. Decrement from the "Unknown" category as users are assigned to specific regions

**Implementation**:
```typescript
// First, get total count of users
const allUsers = await db.select({ id: users.id }).from(users);
      
// Initialize with all users marked as "Unknown" region
regionalStats['Unknown'] = {
  hostCount: allUsers.length,
  guestCount: 0,
  songRequestCount: 0
};

// Process users with known country codes
const countryDistribution = await db
  .select({
    countryCode: userSessions.countryCode,
    userId: userSessions.userId,
    userCount: sql<number>`count(distinct ${userSessions.userId})`,
  })
  .from(userSessions)
  .where(isNotNull(userSessions.countryCode))
  .groupBy(userSessions.countryCode, userSessions.userId);

// Track which users we've assigned to regions
const accountedUserIds = new Set<number>();

// Assign users to their regions and decrement from "Unknown"
for (const countryData of countryDistribution) {
  if (!countryData.countryCode) continue;
  
  const countryCode = countryData.countryCode;
  const userId = Number(countryData.userId);
  
  // Initialize country if needed
  if (!regionalStats[countryCode]) {
    regionalStats[countryCode] = {
      hostCount: 0,
      guestCount: 0,
      songRequestCount: 0
    };
  }
  
  // Only count each user once
  if (!accountedUserIds.has(userId)) {
    regionalStats[countryCode].hostCount += 1;
    accountedUserIds.add(userId);
    
    // Decrement from Unknown category
    regionalStats['Unknown'].hostCount -= 1;
  }
}
```

## 📦 Deployment

Cosmic can be deployed through multiple channels. Below are the primary deployment options:

### GitHub, Jenkins & AWS Deployment Pipeline

#### 1. GitHub Repository Setup

1. **Branch Structure**
   - `main`: Production-ready code
   - `staging`: Pre-production testing
   - `develop`: Active development

2. **Pull Request Workflow**
   - Create feature branches from `develop`
   - Submit PR to `develop` branch
   - Require code reviews and automated tests to pass

3. **GitHub Actions Pre-Checks**
   - Set up `.github/workflows/ci.yml` for:
     - TypeScript type checking
     - ESLint code style validation
     - Unit test execution
     - Code coverage reporting

#### 2. Jenkins CI/CD Pipeline

1. **Jenkins Pipeline Configuration**
   - Set up a Jenkinsfile with stages for checkout, dependencies, testing, building, and deployment
   - Configure conditional deployment to staging or production environments
   - Implement AWS S3 deployment with CloudFront invalidation
   - Set up Slack notifications for build status

2. **Jenkins Configuration**
   - Set up Jenkins with required plugins (AWS Steps, Slack Notification, Node.js)
   - Configure credentials for AWS, GitHub, and Slack
   - Set up webhook from GitHub to trigger builds

#### 3. AWS Infrastructure Setup

1. **Frontend Hosting**
   - S3 bucket for static assets with website configuration
   - CloudFront distribution for CDN capabilities
   - Route53 for DNS management
   - ACM for SSL certificate management

2. **Backend Services**
   - ECS Fargate for containerized backend
   - ECR for Docker image repository
   - RDS PostgreSQL for database
   - ElastiCache for session caching
   - ALB for load balancing

3. **Supporting Infrastructure**
   - CloudWatch for monitoring and logging
   - SNS for notifications
   - IAM roles and policies for secure access
   - VPC configuration with private subnets

4. **Infrastructure as Code**
   - Use Terraform to provision and manage AWS resources
   - Modularize resources for reusability
   - Implement state management via S3 backend
   - Maintain environment-specific configurations

#### 4. Database Migration Strategy

1. **Pre-Deployment**
   - Use Drizzle to generate migration scripts
   - Test migrations on staging environment
   - Backup database before production deployment

2. **Deployment Process**
   - Include migration step in CI/CD pipeline
   - Use credentials management for secure database access
   - Implement migration tracking and versioning

3. **Rollback Strategy**
   - Create reversion scripts for each migration
   - Test rollback procedures in staging
   - Document rollback processes for emergency situations

## 🚀 Recent Improvements

### Enhanced User Experience
- Multiple playlist support with playlist sharing controls
- Account manager assignment for user support
- Comprehensive admin dashboard with usage analytics
- Regional performance metrics and statistics
- Email verification system for enhanced security
- OTP (One-Time Password) authentication support
- Microsoft Clarity integration for user behavior analytics

### Technical Improvements
- Extended authentication cookie lifetime to 7 days (from 24 hours)
- Improved CORS configuration for proper cross-origin requests
- Fixed cookie clearing during logout to prevent orphaned sessions
- Enhanced fetch API credential handling for more reliable authentication
- Optimized database queries for faster playlist loading
- Improved WebSocket reconnection handling

### UI Enhancements
- Added marquee text component to prevent horizontal overflow with long song titles
- Implemented adaptive navigation sections that respond to viewport size
- Fixed multiple YouTube players playing simultaneously
- Improved playlist navigational structure
- Ensured music playback continues when navigation sections are collapsed
- Enhanced admin interface with comprehensive user management tools

## 🤝 Contributing

1. Fork the repository
2. Create a new feature branch from the develop branch
3. Make your changes and commit them with descriptive messages
4. Push your changes to your fork
5. Submit a pull request to the main repository

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.



## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cosmic

# Authentication
SESSION_SECRET=your-session-secret
COOKIE_SECRET=your-cookie-secret

# Email for verification
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email-user
EMAIL_PASS=your-email-password
EMAIL_FROM=no-reply@yourdomain.com

# YouTube API
YOUTUBE_API_KEY=your-youtube-api-key

# Strapi CMS (for song limit tracking)
STRAPI_URL=http://your-strapi-url:1337
STRAPI_ACCESS_TOKEN=your-strapi-access-token

# Analytics
CLARITY_PROJECT_ID=your-microsoft-clarity-id

# Optional
NODE_ENV=development
PORT=5000
```

## Local Development

1. **Clone and set up the project**
   ```bash
   git clone https://github.com/your-org/cosmic.git
   cd cosmic
   npm install
   ```

2. **Initialize database**
   ```bash
   # Synchronize database schema
   npm run db:push
   
   # Initialize system tables
   npm run setup:all
   ```

3. **Start development servers**
   ```bash
   # Start the development server
   npm run dev
   # This will launch both frontend and backend
   # The application will be accessible at the URLs listed in step 4
   ```

4. **Access the application**
   - Frontend: `http://localhost:5000`
   - API: `http://localhost:5000/api`
   - WebSocket: `ws://localhost:5000`

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

## 🐳 Docker Deployment

### Prerequisites
- Docker ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose ([Install Docker Compose](https://docs.docker.com/compose/install/))

### Docker Configuration

1. **Create a Dockerfile in the project root**

```dockerfile
FROM node:18-alpine AS base

# Setup pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

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

# Add start script
COPY scripts/start-prod.js ./scripts/

# Expose application port
EXPOSE 5000

# Set the default command
CMD ["node", "dist/server/index.js"]
```

2. **Create a Docker Compose file**

```yaml
version: '3.8'

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

## API Documentation

The Cosmic platform provides a comprehensive REST API for integration with external systems.

### Authentication Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/auth/register` | POST | Register a new user | `{ email, password, name }` | `{ user, token }` |
| `/api/auth/login` | POST | Authenticate user | `{ email, password }` | `{ user, token }` |
| `/api/auth/verify` | GET | Verify email with token | `?token=[verification_token]` | `{ success }` |
| `/api/auth/logout` | POST | End user session | None | `{ success }` |

### User Management

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/user` | GET | Get current user profile | None | `{ user }` |
| `/api/user` | PUT | Update user profile | `{ name, email, ... }` | `{ user }` |
| `/api/user/sessions` | GET | List active user sessions | None | `{ sessions: [...] }` |
| `/api/user/sessions/:id` | DELETE | Terminate specific session | None | `{ success }` |

### Playlist Management

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/playlists` | GET | List user playlists | None | `{ playlists: [...] }` |
| `/api/playlists` | POST | Create new playlist | `{ name, isVisibleToGuests }` | `{ playlist }` |
| `/api/playlists/:id` | GET | Get playlist details | None | `{ playlist, songs: [...] }` |
| `/api/playlists/:id` | PUT | Update playlist | `{ name, isVisibleToGuests }` | `{ playlist }` |
| `/api/playlists/:id` | DELETE | Delete playlist | None | `{ success }` |

### Song Management

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/playlists/:id/songs` | POST | Add song to playlist | `{ youtubeId, title, artist }` | `{ song }` |
| `/api/playlists/:id/songs/:songId` | DELETE | Remove song from playlist | None | `{ success }` |
| `/api/playlists/:id/songs/reorder` | PUT | Reorder playlist songs | `{ songIds: [...] }` | `{ success }` |
| `/api/search/youtube` | GET | Search YouTube for songs | `?q=[search_term]` | `{ results: [...] }` |

### Administrative Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/admin/users` | GET | List all users | None | `{ users: [...] }` |
| `/api/admin/team` | GET | List team members | None | `{ members: [...] }` |
| `/api/admin/team` | POST | Add team member | `{ email, role }` | `{ member }` |
| `/api/admin/settings` | GET | Get system settings | None | `{ settings: {...} }` |
| `/api/admin/settings` | PUT | Update system settings | `{ ... }` | `{ settings }` |
