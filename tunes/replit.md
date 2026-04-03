# Cosmic - Collaborative Playlist Management Platform

## Overview

Cosmic is a full-stack collaborative playlist management platform that enables venues to create interactive music experiences. The platform allows venue owners to manage playlists while guests can request songs and interact with the music in real-time. Built with a modern tech stack including React, Express, TypeScript, and PostgreSQL.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **UI Library**: Radix UI components with custom theming
- **Styling**: Tailwind CSS with CSS custom properties
- **State Management**: TanStack Query for server state, React Context for client state
- **Real-time Communication**: WebSocket integration for live updates
- **Analytics**: Microsoft Clarity integration for user behavior tracking

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy and session management
- **Real-time**: Socket.IO for WebSocket connections
- **API Documentation**: Swagger UI for endpoint documentation
- **Email Service**: AWS SES integration for transactional emails

### Data Storage Solutions
- **Primary Database**: PostgreSQL with connection pooling
- **ORM**: Drizzle ORM for type-safe database operations
- **Session Store**: PostgreSQL-based session storage
- **Migrations**: Drizzle Kit for schema management

## Key Components

### Authentication and Authorization
- **Multi-factor Authentication**: Email-based OTP system
- **Role-based Access Control**: Admin, venue owner, staff, and guest roles
- **Session Management**: Secure cookie-based sessions with 7-day persistence
- **Email Verification**: Required for account activation

### Music Integration
- **YouTube API**: For music search and playback functionality
- **Real-time Playlist Updates**: Live synchronization across all connected clients
- **Queue Management**: Drag-and-drop reordering with play status tracking
- **Guest Interaction**: Song request system with moderation capabilities

### Venue Management
- **Custom Branding**: Configurable themes and venue profiles
- **Feature Toggles**: Granular control over guest permissions
- **QR Code Generation**: Easy guest access via QR codes
- **Analytics Dashboard**: Usage metrics and guest activity tracking

### Administrative Tools
- **Super Admin Panel**: System-wide management capabilities
- **User Management**: Account creation, modification, and deletion
- **System Health Monitoring**: Performance and usage analytics
- **Content Management**: SEO settings and page content management

## Data Flow

1. **User Registration**: New users register with email verification
2. **Authentication**: Login with username/password + optional OTP
3. **Venue Setup**: Configure venue details, themes, and permissions
4. **Playlist Management**: Create and manage multiple playlists
5. **Guest Access**: Share guest URLs or QR codes for public access
6. **Real-time Updates**: WebSocket synchronization for all connected clients
7. **Analytics Tracking**: Microsoft Clarity tracks user interactions
8. **Session Management**: Secure session persistence across devices

## External Dependencies

### Required Services
- **PostgreSQL Database**: Primary data storage
- **AWS SES**: Email delivery service
- **YouTube API**: Music search and metadata
- **Microsoft Clarity**: User behavior analytics

### Optional Integrations
- **Google Analytics**: Additional analytics tracking
- **Facebook Pixel**: Social media analytics
- **Google Tag Manager**: Marketing tag management

## Deployment Strategy

### Development Environment
- **Replit Integration**: Cloud-based development with auto-reload
- **Environment Variables**: Secure configuration management
- **Hot Module Replacement**: Vite-powered development server

### Production Deployment
- **Docker Support**: Multi-stage Dockerfile for optimized builds
- **Cloud Run**: Google Cloud deployment target
- **Static Assets**: Efficient serving of frontend assets
- **Database Migrations**: Automated schema updates

### Security Considerations
- **CORS Configuration**: Secure cross-origin request handling
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Zod schema validation throughout
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM


test

## Changelog
- June 20, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.
