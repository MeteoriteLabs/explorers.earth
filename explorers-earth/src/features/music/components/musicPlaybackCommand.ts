export type MusicPlaybackCommandOutcome = "acknowledged" | "superseded";

export type MusicPlaybackCommand = (
  songId: number | null,
  requestId: number,
  operation: string,
) => Promise<MusicPlaybackCommandOutcome>;

const PLAYBACK_TIMEOUT_REASON = Object.freeze({ kind: "music-playback-timeout" });
const PLAYBACK_CANCEL_REASON = Object.freeze({ kind: "music-playback-authority-change" });

export interface MusicPlaybackArbiter {
  beginPlaybackRequest: () => number;
  requestPlayback: MusicPlaybackCommand;
  cancel: () => void;
}

export function createMusicPlaybackArbiter({
  write,
  onAcknowledged,
  currentRevision = () => 0,
  isAuthorityCurrent = () => true,
  timeoutMs = 10_000,
}: {
  write: (songId: number | null, expectedRevision: number, operation: string, signal: AbortSignal) => Promise<{ revision: number; acknowledged?: boolean }>;
  onAcknowledged: (songId: number | null, requestId: number) => void;
  currentRevision?: () => number;
  isAuthorityCurrent?: () => boolean;
  timeoutMs?: number;
}): MusicPlaybackArbiter {
  let sequence = 0;
  let knownRevision = 0;
  let tail = Promise.resolve();
  let cancelled = false;
  const active = new Set<AbortController>();

  const requestPlayback: MusicPlaybackCommand = (songId, requestId, operation) => {
    const execute = async (): Promise<MusicPlaybackCommandOutcome> => {
      if (cancelled || requestId !== sequence || !isAuthorityCurrent()) return "superseded";
      const controller = new AbortController();
      active.add(controller);
      const timeout = globalThis.setTimeout(() => controller.abort(PLAYBACK_TIMEOUT_REASON), timeoutMs);
      try {
        const expectedRevision = Math.max(knownRevision, currentRevision());
        const result = await abortablePlayback(write(songId, expectedRevision, operation, controller.signal), controller.signal);
        knownRevision = Math.max(knownRevision, result.revision);
        if (result.acknowledged === false) return "superseded";
      } catch (cause) {
        if (cancelled || requestId !== sequence || !isAuthorityCurrent() || controller.signal.reason === PLAYBACK_CANCEL_REASON) return "superseded";
        if (controller.signal.reason === PLAYBACK_TIMEOUT_REASON) throw new Error("Music playback update timed out.");
        throw cause;
      } finally {
        globalThis.clearTimeout(timeout);
        active.delete(controller);
      }
      if (cancelled || requestId !== sequence || !isAuthorityCurrent()) return "superseded";
      onAcknowledged(songId, requestId);
      return "acknowledged";
    };
    const command = tail.then(execute, execute);
    tail = command.then(() => undefined, () => undefined);
    return command;
  };

  return {
    beginPlaybackRequest: () => {
      sequence += 1;
      return sequence;
    },
    requestPlayback,
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      sequence += 1;
      active.forEach((controller) => controller.abort(PLAYBACK_CANCEL_REASON));
      active.clear();
    },
  };
}

function abortablePlayback<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
