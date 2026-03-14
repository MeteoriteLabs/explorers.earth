# ADR-003: Socket.IO for Real-time Communication

## Status
Accepted

## Context
tunes requires real-time synchronization for playlist state — when a host adds a song, skips a track, or a guest requests a song, all connected clients must see the change immediately. This is core to the product experience (venues with live music queues).

## Decision
Use **Socket.IO** for all real-time communication in tunes. Socket.IO provides:
- WebSocket connections with automatic HTTP long-polling fallback
- Room-based broadcasting (one room per user/venue)
- Automatic reconnection with exponential backoff
- Event-based messaging with structured payloads

## Consequences

**Easier**:
- Reliable connections across different network conditions (fallback transport)
- Room abstraction simplifies scoping events to a specific venue
- Built-in reconnection — clients recover automatically from temporary disconnects
- Large ecosystem and community support
- Integrates well with Express.js (same server instance)

**Harder**:
- Additional library dependency (~50KB client-side)
- Socket.IO protocol is not compatible with raw WebSocket clients
- Scaling horizontally requires a Socket.IO adapter (e.g., Redis adapter) for multi-server setups
- Debugging is harder than REST — events are bidirectional and async

## Alternatives Considered

**Raw WebSocket API**: Lower overhead, no library dependency. Rejected because it lacks automatic reconnection, room management, and transport fallback — all of which would need custom implementation.

**Server-Sent Events (SSE)**: Simpler for server-to-client push. Rejected because tunes needs bidirectional communication (client sends player state, guest sends song requests).

**HTTP polling**: Simplest to implement. Rejected because the latency (seconds between polls) is unacceptable for a live music queue experience.
