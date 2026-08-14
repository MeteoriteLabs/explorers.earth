import type { EventEmitter } from "node:events";

const CHANNEL = "music_identity_suspended";
const READINESS_LOCK = "music:identity-suspension-listener-ready";

interface Notification {
  channel: string;
  payload?: string;
}

interface ListenClient extends EventEmitter {
  query(sql: string): Promise<unknown>;
  release(): void;
}

interface ListenPool {
  connect(): Promise<ListenClient>;
}

export interface MusicReconciliationSuspensionListener {
  stop(): Promise<void>;
}

function parseMusicUserId(payload: string | undefined): number | undefined {
  if (!payload || !/^[1-9]\d*$/.test(payload)) return undefined;
  const musicUserId = Number(payload);
  return Number.isSafeInteger(musicUserId) ? musicUserId : undefined;
}

export async function startMusicReconciliationSuspensionListener(options: {
  pool: ListenPool;
  disconnectOwner(musicUserId: number): Promise<void>;
  onDisconnectError(error: unknown): void;
  onFatal(error: unknown): void;
  maxConcurrency?: number;
  maxPending?: number;
}): Promise<MusicReconciliationSuspensionListener> {
  const maxConcurrency = options.maxConcurrency ?? 8;
  const maxPending = options.maxPending ?? 1_000;
  if (!Number.isSafeInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > 32
      || !Number.isSafeInteger(maxPending) || maxPending < maxConcurrency || maxPending > 10_000) {
    throw new Error("Music reconciliation listener bounds are invalid");
  }
  const client = await options.pool.connect();
  let accepting = true;
  let active = 0;
  let fatal = false;
  const queue: number[] = [];
  const drained: Array<() => void> = [];
  let stopPromise: Promise<void> | undefined;
  const resolveDrained = (): void => {
    if (active === 0 && queue.length === 0) drained.splice(0).forEach((resolve) => resolve());
  };
  const pump = (): void => {
    while (active < maxConcurrency && queue.length > 0) {
      const musicUserId = queue.shift()!;
      active += 1;
      void options.disconnectOwner(musicUserId).catch(options.onDisconnectError).finally(() => {
        active -= 1;
        pump();
        resolveDrained();
      });
    }
    resolveDrained();
  };
  const onNotification = (notification: Notification): void => {
    if (!accepting || notification.channel !== CHANNEL) return;
    const musicUserId = parseMusicUserId(notification.payload);
    if (musicUserId === undefined) return;
    if (active + queue.length >= maxPending) {
      accepting = false;
      fatal = true;
      options.onFatal(new Error("Music reconciliation listener queue capacity exceeded"));
      return;
    }
    queue.push(musicUserId);
    pump();
  };
  const onClientError = (error: unknown): void => {
    accepting = false;
    if (!fatal) {
      fatal = true;
      options.onFatal(error);
    }
  };

  client.on("notification", onNotification);
  client.on("error", onClientError);
  try {
    await client.query("SET application_name = 'music-reconciliation-suspension-listener'");
    await client.query(`LISTEN ${CHANNEL}`);
    await client.query(`SELECT pg_advisory_lock_shared(hashtextextended('${READINESS_LOCK}',0))`);
  } catch (error) {
    client.off("notification", onNotification);
    client.off("error", onClientError);
    client.release();
    throw error;
  }

  return {
    stop(): Promise<void> {
      if (stopPromise) return stopPromise;
      accepting = false;
      client.off("notification", onNotification);
      client.off("error", onClientError);
      stopPromise = (async () => {
        if (active > 0 || queue.length > 0) await new Promise<void>((resolve) => drained.push(resolve));
        try {
          await client.query(`SELECT pg_advisory_unlock_shared(hashtextextended('${READINESS_LOCK}',0))`);
          await client.query(`UNLISTEN ${CHANNEL}`);
        } finally {
          client.release();
        }
      })();
      return stopPromise;
    },
  };
}
