import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { Express } from "express";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { MusicIdentityError, musicErrorEnvelope } from "../../shared/musicError";
import { MusicPrincipalError, type MusicPrincipal, type MusicSocketCredentialContext } from "../middleware/musicPrincipal";

interface OwnerCredentialVerifier {
  handshake(input: { token: string }): Promise<MusicSocketCredentialContext>;
  recheck(context: MusicSocketCredentialContext): Promise<MusicPrincipal>;
}

export class MusicOwnerSocketRegistry {
  private disconnect: ((musicUserId: number) => Promise<void>) | undefined;
  private disconnectAll: (() => Promise<void>) | undefined;
  private readonly epochs = new Map<number, number>();
  private admissionEpoch = 0;
  private admissionsOpen = true;

  bind(disconnect: (musicUserId: number) => Promise<void>, disconnectAll?: () => Promise<void>): void {
    if (this.disconnect) throw new Error("Music owner socket registry is already bound");
    this.disconnect = disconnect;
    this.disconnectAll = disconnectAll;
  }

  async disconnectAllSockets(): Promise<void> {
    if (!this.disconnectAll) throw new Error("Music socket registry is unavailable");
    this.admissionsOpen = false;
    this.admissionEpoch += 1;
    await this.disconnectAll();
  }

  async disconnectOwner(musicUserId: number): Promise<void> {
    if (!Number.isSafeInteger(musicUserId) || musicUserId < 1 || !this.disconnect) {
      throw new Error("Music owner socket registry is unavailable");
    }
    this.epochs.set(musicUserId, this.captureEpoch(musicUserId) + 1);
    await this.disconnect(musicUserId);
  }

  captureEpoch(musicUserId: number): number {
    return this.epochs.get(musicUserId) ?? 0;
  }

  isCurrent(musicUserId: number, epoch: number): boolean {
    return this.captureEpoch(musicUserId) === epoch;
  }

  captureAdmissionEpoch(): number {
    return this.admissionEpoch;
  }

  isAdmissionCurrent(epoch: number): boolean {
    return this.admissionsOpen && this.admissionEpoch === epoch;
  }
}

export interface MusicSocketDependencies {
  allowedOrigins: string[];
  ownerCredentials: OwnerCredentialVerifier;
  resolveGuestCapability(capability: string): Promise<{
    musicUserId: number;
    active: boolean;
    allowSongRequests: boolean;
  } | undefined>;
  eventLimit?: number;
  eventWindowMs?: number;
  ownerRegistry?: MusicOwnerSocketRegistry;
}

type SocketAuthority =
  | { role: "owner"; musicUserId: number; owner: MusicSocketCredentialContext; rateKey: string }
  | { role: "guest"; musicUserId: number; capability: string; rateKey: string };

export function createMusicSocketServer(app: Express, dependencies: MusicSocketDependencies): Server {
  const server = createServer(app);
  const io = new SocketIOServer(server, {
    path: "/ws",
    transports: ["websocket", "polling"],
    maxHttpBufferSize: 64 * 1024,
    cors: { origin: dependencies.allowedOrigins, credentials: false, methods: ["GET", "POST"] },
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      callback(origin && dependencies.allowedOrigins.includes(origin) ? undefined : "origin not allowed", !!origin && dependencies.allowedOrigins.includes(origin));
    },
  });
  dependencies.ownerRegistry?.bind(
    async (musicUserId) => {
      const sockets = await io.in(`music-owner:${musicUserId}`).fetchSockets();
      await Promise.all(sockets.map(async (socket) => {
        socket.emit("music_error", musicErrorEnvelope(
          new MusicIdentityError("TOKEN_REVOKED", 401, "The Music credential has been revoked.", "authenticate", false),
          randomUUID(),
        ));
        socket.disconnect(true);
      }));
    },
    async () => { io.disconnectSockets(true); },
  );
  const limiter = new Map<string, { count: number; resetAt: number }>();
  const eventLimit = dependencies.eventLimit ?? 10;
  const eventWindowMs = dependencies.eventWindowMs ?? 60_000;

  const authorityIsCurrent = async (authority: SocketAuthority, expectedRole: SocketAuthority["role"]): Promise<boolean> => {
    if (authority.role !== expectedRole) return false;
    if (authority.role === "owner") {
      try {
        const principal = await dependencies.ownerCredentials.recheck(authority.owner);
        return principal.musicUserId === authority.musicUserId;
      } catch {
        return false;
      }
    }
    const guest = await dependencies.resolveGuestCapability(authority.capability);
    return guest?.active === true && guest.musicUserId === authority.musicUserId;
  };

  const emitToAuthorizedRecipients = async (
    room: string,
    expectedRole: SocketAuthority["role"],
    event: string,
    payload: unknown,
  ) => {
    const recipients = await io.in(room).fetchSockets();
    await Promise.all(recipients.map(async (recipient) => {
      const recipientAuthority = recipient.data.musicAuthority as SocketAuthority | undefined;
      if (!recipientAuthority || !await authorityIsCurrent(recipientAuthority, expectedRole)) {
        const error = recipientAuthority?.role === "guest" ? guestInvalid() : new MusicPrincipalError("TOKEN_REVOKED", 401, "The Music credential has been revoked.");
        recipient.emit("music_error", musicErrorEnvelope(safeSocketError(error), randomUUID()));
        await recipient.leave(room);
        recipient.disconnect(true);
        return;
      }
      recipient.emit(event, payload);
    }));
  };

  io.use(async (socket, next) => {
    try {
      const admissionEpoch = dependencies.ownerRegistry?.captureAdmissionEpoch();
      if (admissionEpoch !== undefined && !dependencies.ownerRegistry?.isAdmissionCurrent(admissionEpoch)) throw admissionUnavailable();
      const origin = socket.handshake.headers.origin;
      if (!origin || !dependencies.allowedOrigins.includes(origin)) throw routeError("ORIGIN_FORBIDDEN", 403, "The socket origin is not allowed.");
      const auth = socket.handshake.auth;
      const token = typeof auth?.token === "string" ? auth.token : undefined;
      const capability = typeof auth?.guestCapability === "string" ? auth.guestCapability : undefined;
      if ((token ? 1 : 0) + (capability ? 1 : 0) !== 1) throw new MusicPrincipalError("TOKEN_INVALID", 401, "A single Music socket credential is required.");
      let authority: SocketAuthority;
      if (token) {
        const owner = await dependencies.ownerCredentials.handshake({ token });
        authority = {
          role: "owner",
          musicUserId: owner.principal.musicUserId,
          owner,
          rateKey: `owner:${owner.principal.subject}`,
        };
      } else {
        if (!capability || !/^[A-Za-z0-9_-]{43}$/.test(capability)) throw guestInvalid();
        const guest = await dependencies.resolveGuestCapability(capability);
        if (!guest?.active) throw guestInvalid();
        authority = {
          role: "guest",
          musicUserId: guest.musicUserId,
          capability,
          rateKey: `guest:${createHash("sha256").update(capability).digest("hex")}`,
        };
      }
      if (admissionEpoch !== undefined && !dependencies.ownerRegistry?.isAdmissionCurrent(admissionEpoch)) throw admissionUnavailable();
      socket.data.musicAuthority = authority;
      socket.data.musicAdmissionEpoch = admissionEpoch;
      next();
    } catch (cause) {
      const error = safeSocketError(cause);
      const failure = new Error(error.message) as Error & { data?: unknown };
      failure.data = musicErrorEnvelope(error, randomUUID());
      next(failure);
    }
  });

  io.on("connection", async (socket: Socket) => {
    const authority = socket.data.musicAuthority as SocketAuthority;
    const admissionEpoch = socket.data.musicAdmissionEpoch as number | undefined;
    const admissionIsCurrent = () => admissionEpoch === undefined
      || dependencies.ownerRegistry?.isAdmissionCurrent(admissionEpoch) === true;
    const room = authority.role === "owner"
      ? `music-owner:${authority.musicUserId}`
      : `music-guest:${authority.musicUserId}`;
    const ownerEpoch = authority.role === "owner"
      ? dependencies.ownerRegistry?.captureEpoch(authority.musicUserId)
      : undefined;
    if (!admissionIsCurrent()
        || !await authorityIsCurrent(authority, authority.role)
        || !admissionIsCurrent()
        || ownerEpoch !== undefined && !dependencies.ownerRegistry?.isCurrent(authority.musicUserId, ownerEpoch)) {
      socket.disconnect(true);
      return;
    }
    await socket.join(room);
    if (!admissionIsCurrent()
        || !await authorityIsCurrent(authority, authority.role)
        || !admissionIsCurrent()
        || ownerEpoch !== undefined && !dependencies.ownerRegistry?.isCurrent(authority.musicUserId, ownerEpoch)) {
      await socket.leave(room);
      socket.disconnect(true);
      return;
    }
    socket.emit("connection_status", { status: "connected", role: authority.role, requestId: randomUUID() });

    const fail = (cause: unknown) => {
      const error = safeSocketError(cause);
      socket.emit("music_error", musicErrorEnvelope(error, randomUUID()));
    };
    const evict = (cause: unknown) => {
      fail(cause);
      socket.disconnect(true);
    };
    const accept = (payload: unknown): boolean => {
      let bytes: number;
      try { bytes = Buffer.byteLength(JSON.stringify(payload), "utf8"); } catch { fail(routeError("REQUEST_INVALID", 400, "The socket payload is invalid.")); return false; }
      if (bytes > 2_048) { fail(routeError("PAYLOAD_TOO_LARGE", 400, "The socket payload is too large.")); return false; }
      const now = Date.now();
      const key = `${authority.rateKey}:${socket.handshake.address}`;
      const current = limiter.get(key);
      if (!current || current.resetAt <= now) {
        limiter.set(key, { count: 1, resetAt: now + eventWindowMs });
        return true;
      }
      current.count += 1;
      if (current.count > eventLimit) { fail(routeError("RATE_LIMITED", 429, "Too many Music socket events.")); return false; }
      return true;
    };

    socket.onAny((event) => {
      if (!new Set(["player_state", "guest_request"]).has(event)) {
        fail(routeError("SOCKET_EVENT_FORBIDDEN", 403, "The socket event is not allowed."));
      }
    });

    socket.on("player_state", async (payload: unknown) => {
      if (authority.role !== "owner") return fail(routeError("SOCKET_EVENT_FORBIDDEN", 403, "The socket event is not allowed."));
      if (!accept(payload)) return;
      try {
        const principal = await dependencies.ownerCredentials.recheck(authority.owner);
        if (principal.musicUserId !== authority.musicUserId) throw new MusicPrincipalError("TOKEN_REVOKED", 401, "The Music credential has been revoked.");
      } catch (cause) { return evict(cause); }
      if (!validPlayerState(payload)) return fail(routeError("REQUEST_INVALID", 400, "The socket payload is invalid."));
      await emitToAuthorizedRecipients(`music-guest:${authority.musicUserId}`, "guest", "player_state", payload);
    });

    socket.on("guest_request", async (payload: unknown) => {
      if (authority.role !== "guest") return fail(routeError("SOCKET_EVENT_FORBIDDEN", 403, "The socket event is not allowed."));
      if (!accept(payload)) return;
      try {
        const guest = await dependencies.resolveGuestCapability(authority.capability);
        if (!guest?.active || guest.musicUserId !== authority.musicUserId || !guest.allowSongRequests) throw guestInvalid();
      } catch (cause) { return evict(cause); }
      if (!validGuestRequest(payload)) return fail(routeError("REQUEST_INVALID", 400, "The socket payload is invalid."));
      const requestId = randomUUID();
      const event = payload as { type: "song"; externalId: string };
      await emitToAuthorizedRecipients(`music-owner:${authority.musicUserId}`, "owner", "guest_request", { ...event, requestId });
      socket.emit("guest_request_status", { status: "accepted", requestId });
    });
  });

  return server;
}

function validPlayerState(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.playing === "boolean"
    && (entry.position === undefined || typeof entry.position === "number")
    && (entry.externalId === undefined || typeof entry.externalId === "string" && entry.externalId.length <= 256)
    && Object.keys(entry).every((key) => ["playing", "position", "externalId"].includes(key));
}

function validGuestRequest(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return entry.type === "song" && typeof entry.externalId === "string" && entry.externalId.length >= 1 && entry.externalId.length <= 256
    && Object.keys(entry).every((key) => ["type", "externalId"].includes(key));
}

function guestInvalid() {
  return routeError("GUEST_CAPABILITY_INVALID", 401, "The guest capability is invalid.");
}

function admissionUnavailable() {
  return new MusicPrincipalError("TOKEN_INVALID", 401, "Music socket admission is unavailable.");
}

function routeError(code: MusicIdentityError["code"], status: number, message: string) {
  return new MusicIdentityError(code, status, message, status === 401 ? "authenticate" : "none", false);
}

function safeSocketError(cause: unknown): MusicIdentityError {
  if (cause instanceof MusicIdentityError) return cause;
  if (cause instanceof MusicPrincipalError) return new MusicIdentityError(cause.code, cause.status, cause.message, "authenticate", false);
  return new MusicIdentityError("TOKEN_INVALID", 401, "The Music socket credential is invalid.", "authenticate", false);
}
