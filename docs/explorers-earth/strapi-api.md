# explorers-earth — Strapi CMS API Reference

## Overview

explorers-earth uses an external Strapi CMS as its backend. All data operations (users, places, lists, recommendations) go through Strapi's APIs. This document provides the API endpoints for agents and developers who need to understand or interact with the CMS data model.

## API Endpoints

### REST API Documentation

**URL**: `http://77.42.95.255:1337/documentation`

The Strapi REST API documentation (Swagger/OpenAPI) is served at the above URL. Use this to:
- Browse all available content types and their fields
- See request/response schemas for CRUD operations
- Test endpoints directly
- Understand authentication requirements

### GraphQL Playground

**URL**: `http://77.42.95.255:1337/graphql`

The GraphQL Playground is available for interactive query exploration. Use this to:
- Explore the full GraphQL schema (queries, mutations, types)
- Test GraphQL queries and mutations
- View auto-generated documentation for all content types
- Understand relationships between content types

## How explorers-earth Uses Strapi

### GraphQL (Primary)

All data fetching and mutations go through GraphQL via Apollo Client:

```typescript
// Example: Fetching user's favorite places
const { data } = useQuery(gql`
  query GetPlaces($userId: ID!) {
    places(filters: { user: { id: { eq: $userId } } }) {
      data {
        id
        attributes {
          name
          description
          latitude
          longitude
          photos
          rating
        }
      }
    }
  }
`);
```

**Endpoint configured via**: `VITE_API_URL` environment variable

### REST API (Secondary)

Used primarily for file uploads and operations that are simpler via REST:

```typescript
// Example: Uploading an image
const formData = new FormData();
formData.append('files', imageFile);
await axios.post(`${VITE_REST_API_URL}/api/upload`, formData);
```

**Endpoint configured via**: `VITE_REST_API_URL` environment variable

## Authentication with Strapi

- **JWT tokens**: Strapi provides JWT on login/register, stored in localStorage
- **Public access**: `VITE_PUBLIC_ACCESS_TOKEN` for unauthenticated content
- **Google OAuth**: Strapi handles OAuth callback and returns JWT
- **Authorization header**: `Authorization: Bearer <jwt-token>`

## Content Types

To see the full list of Strapi content types (collections and single types), visit the REST API documentation at the URL above. Common content types used by explorers-earth include:
- Users (authentication and profiles)
- Places/Locations (recommendations)
- Lists (themed collections)
- Categories (place categorization)
- Media (uploaded images)

## For AI Agents

When working on explorers-earth features that interact with data:
1. Check the GraphQL Playground to understand available fields and relationships
2. Look at existing queries in `src/features/` components for patterns
3. Apollo Client handles caching — use `refetchQueries` or cache updates after mutations
4. Public content uses the public access token; authenticated content requires the user's JWT

## Key Files

| File | Purpose |
|------|---------|
| `src/services/` | Service functions that wrap API calls |
| `src/lib/apiClient.ts` | API client for tunes integration (not Strapi) |
| Apollo Client setup | Configured in app initialization with `VITE_API_URL` |
