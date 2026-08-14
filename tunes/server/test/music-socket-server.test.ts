import express from "express";
import { io as connectSocket, type Socket } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MusicPrincipalError } from "../middleware/musicPrincipal";
import { createMusicSocketServer } from "../socket/musicSocketServer";

describe("canonical C5 owner and guest capability socket", () => {
  const sockets: Socket[] = [];
  const capability = "A".repeat(43);
  let revoked = false;
  let expired = false;
  let internalFailure = false;
  let server: ReturnType<typeof createMusicSocketServer>;
  let url: string;

  beforeAll(async () => {
    server = createMusicSocketServer(express(), {
      allowedOrigins: ["https://explorers.example"],
      ownerCredentials: {
        handshake: async ({ token }) => {
          if (token !== "aaa.bbb.ccc") throw new MusicPrincipalError("TOKEN_INVALID", 401, "invalid");
          if (expired) throw new MusicPrincipalError("TOKEN_EXPIRED", 401, "expired");
          return { token, principal: { musicUserId: 41, subject: "owner-41", accountDocumentId: "account", sessionVersion: 2 } };
        },
        recheck: async (context) => {
          if (expired) throw new MusicPrincipalError("TOKEN_EXPIRED", 401, "expired");
          return context.principal;
        },
      },
      resolveGuestCapability: async (candidate) => {
        if (internalFailure) throw new Error("repository detail");
        return candidate === capability && !revoked
          ? { musicUserId: 41, active: true, allowSongRequests: true }
          : undefined;
      },
      eventLimit: 3,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("socket test server did not bind");
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  afterEach(() => {
    revoked = false;
    expired = false;
    internalFailure = false;
  });

  function connect(auth: Record<string, string>, origin = "https://explorers.example") {
    return new Promise<Socket>((resolve, reject) => {
      const socket = connectSocket(url, { path: "/ws", transports: ["websocket"], reconnection: false, auth, extraHeaders: { Origin: origin } });
      sockets.push(socket);
      socket.once("connect", () => resolve(socket));
      socket.once("connect_error", reject);
    });
  }

  it("rejects native/absent credentials and a non-allowlisted origin", async () => {
    // Break caught: session cookies or permissive origins substitute for C5/capability authority.
    await expect(connect({}, "https://evil.example")).rejects.toThrow();
    await expect(connect({ nativeSession: "cosmic.sid" })).rejects.toMatchObject({ data: { error: { code: "TOKEN_INVALID" } } });
    internalFailure = true;
    await expect(connect({ guestCapability: capability })).rejects.toMatchObject({ data: { error: { code: "TOKEN_INVALID" } } });
  });

  it("keeps guest and owner rooms separate while delivering only allowlisted events", async () => {
    // Break caught: a guest joins an owner mutation room or can emit player_state.
    const owner = await connect({ token: "aaa.bbb.ccc" });
    const guest = await connect({ guestCapability: capability });
    const delivered = new Promise<Record<string, unknown>>((resolve) => owner.once("guest_request", resolve));
    guest.emit("guest_request", { type: "song", externalId: "yt:abc" });
    await expect(delivered).resolves.toEqual(expect.objectContaining({ type: "song", externalId: "yt:abc", requestId: expect.any(String) }));
    const denied = new Promise<Record<string, any>>((resolve) => guest.once("music_error", resolve));
    guest.emit("player_state", { playing: true });
    await expect(denied).resolves.toEqual({ version: "music-error/v1", error: expect.objectContaining({ code: "SOCKET_EVENT_FORBIDDEN" }) });
    const unknown = new Promise<Record<string, any>>((resolve) => owner.once("music_error", resolve));
    owner.emit("admin_override", { target: 41 });
    await expect(unknown).resolves.toEqual({ version: "music-error/v1", error: expect.objectContaining({ code: "SOCKET_EVENT_FORBIDDEN", requestId: expect.any(String) }) });
  });

  it("rechecks lifecycle and capability revocation at event time", async () => {
    // Break caught: a connected socket retains authority after token expiry or guest revocation.
    const owner = await connect({ token: "aaa.bbb.ccc" });
    const guest = await connect({ guestCapability: capability });
    revoked = true;
    const guestFailure = new Promise<Record<string, any>>((resolve) => guest.once("music_error", resolve));
    guest.emit("guest_request", { type: "song", externalId: "yt:revoked" });
    await expect(guestFailure).resolves.toEqual({ version: "music-error/v1", error: expect.objectContaining({ code: "GUEST_CAPABILITY_INVALID" }) });
    revoked = false;
    expired = true;
    const ownerFailure = new Promise<Record<string, any>>((resolve) => owner.once("music_error", resolve));
    owner.emit("player_state", { playing: true, position: 1 });
    await expect(ownerFailure).resolves.toEqual({ version: "music-error/v1", error: expect.objectContaining({ code: "TOKEN_EXPIRED" }) });
    expired = false;
  });

  it("evicts a revoked guest before a valid owner broadcasts to guest recipients", async () => {
    // Break caught: a guest that never emits remains in the room after its capability is rotated or revoked.
    const owner = await connect({ token: "aaa.bbb.ccc" });
    const guest = await connect({ guestCapability: capability });
    let received = false;
    guest.once("player_state", () => { received = true; });

    revoked = true;
    owner.emit("player_state", { playing: true, position: 9 });
    await new Promise((resolve) => setTimeout(resolve, 75));

    expect(received).toBe(false);
    expect(guest.connected).toBe(false);
    await expect(connect({ guestCapability: capability })).rejects.toMatchObject({
      data: { error: { code: "GUEST_CAPABILITY_INVALID" } },
    });
    revoked = false;
  });

  it("evicts an expired owner before a valid guest broadcasts to owner recipients", async () => {
    // Break caught: an owner that never emits retains inbound guest-request authority after expiry/revocation.
    const owner = await connect({ token: "aaa.bbb.ccc" });
    const guest = await connect({ guestCapability: capability });
    let received = false;
    owner.once("guest_request", () => { received = true; });

    expired = true;
    guest.emit("guest_request", { type: "song", externalId: "yt:recipient-expiry" });
    await new Promise((resolve) => setTimeout(resolve, 75));

    expect(received).toBe(false);
    expect(owner.connected).toBe(false);
    await expect(connect({ token: "aaa.bbb.ccc" })).rejects.toMatchObject({
      data: { error: { code: "TOKEN_EXPIRED" } },
    });
    expired = false;
  });

  it("enforces reconnect-persistent rate and payload bounds", async () => {
    // Break caught: reconnect resets guest rate authority or oversized payload reaches a room.
    const guest = await connect({ guestCapability: capability });
    const payloadFailure = new Promise<Record<string, any>>((resolve) => guest.once("music_error", resolve));
    guest.emit("guest_request", { type: "song", externalId: "x".repeat(3_000) });
    await expect(payloadFailure).resolves.toEqual({ version: "music-error/v1", error: expect.objectContaining({ code: "PAYLOAD_TOO_LARGE" }) });
    for (let index = 0; index < 3; index += 1) guest.emit("guest_request", { type: "song", externalId: `yt:${index}` });
    await new Promise((resolve) => setTimeout(resolve, 20));
    guest.close();
    const reconnected = await connect({ guestCapability: capability });
    const rateFailure = new Promise<Record<string, any>>((resolve) => reconnected.once("music_error", resolve));
    reconnected.emit("guest_request", { type: "song", externalId: "yt:again" });
    await expect(rateFailure).resolves.toEqual({ version: "music-error/v1", error: expect.objectContaining({ code: "RATE_LIMITED" }) });
    expect(vi.isMockFunction(server.listen)).toBe(false);
  });
});
