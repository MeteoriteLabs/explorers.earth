# ADR-002: Different Authentication Strategies Per App

## Status
Superseded in part

## Context
The two apps have fundamentally different backend architectures:
- **explorers-earth** is a frontend SPA backed by an external Strapi CMS
- **tunes** is a full-stack app with its own Express.js backend

Each app originally needed an authentication approach that matched its architecture and deployment model. The accepted standalone choices remain useful, but the embedded Music surface now requires one canonical identity across the boundary.

## Decision

**explorers-earth**: JWT-based authentication is provided by Strapi CMS, with Google OAuth as an alternative sign-in method.

**Standalone tunes**: Session-based authentication via Passport.js with `express-session`, backed by the PostgreSQL session store, remains the native-app boundary.

**Embedded Music**: The original independent-account decision is superseded by the [canonical Music identity architecture](../architecture/music-identity.md). A verified Strapi identity is projected to one `Account` and one Music user. The Explorer bearer is forwarded only to `POST /api/music/identity/ensure` at the identity/lifecycle boundary and is never reused on canonical owner routes. The server completes a bodyless ensure operation, returns a short-lived Music credential, and resolves every owner predicate from the credential's numeric user ID. Caller-supplied display identifiers are not authorization authority. The detailed boundary is published in the [Music authentication model](../security/music-auth-model.md).

## Consequences

**Easier**:
- Each app uses the auth pattern that naturally fits its architecture
- explorers-earth benefits from Strapi's built-in auth (no custom auth code needed)
- standalone tunes retains server-side session invalidation and native session controls
- embedded Music has one deterministic canonical identity and a narrowly scoped credential lifetime

**Harder**:
- The projection and credential exchange add an explicit integration boundary that must stay covered by lifecycle, authorization, and redaction contracts
- Standalone sessions and embedded credentials have different revocation and expiry behavior
- Canonical identity reconciliation must preserve one numeric owner across email and public-name changes

## Alternatives Considered

**External centralized identity provider**: An additional service such as Auth0 or Keycloak was not required. Strapi remains the verified identity source and the projection contract keeps the integration narrow.

**Reusing a browser or long-lived token in Tunes**: Rejected because it broadens bearer scope and couples Tunes to Strapi token semantics. The adopted exchange issues only the short-lived, audience-bound Music credential while native Tunes sessions remain server-revocable.
