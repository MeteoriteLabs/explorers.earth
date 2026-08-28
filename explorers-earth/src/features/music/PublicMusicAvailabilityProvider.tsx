import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@apollo/client";
import { useParams } from "react-router-dom";
import { getPublicAccountBasicQuery } from "../PublicHome/api/query";
import { publicMusicClient, PublicMusicError, type PublicMusicDescriptor } from "./publicMusicClient";

export type AvailabilityState = "loading" | "available" | "revalidating" | "revoked" | "not-public" | "unavailable";
type Availability = { state: AvailabilityState; account?: Record<string, any>; descriptor?: PublicMusicDescriptor; retry: () => void };
type AccountState = { accountId?: string; state: AvailabilityState; descriptor?: PublicMusicDescriptor };
const AvailabilityContext = createContext<Availability | null>(null);
const unavailableOutsideProfileShell: Availability = { state: "unavailable", retry: () => undefined };
export const PUBLIC_MUSIC_DESCRIPTOR_MAX_AGE_MS = 30_000;

export function PublicMusicAvailabilityProvider({ children }: { children: ReactNode }) {
  const { username } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [resolved, setResolved] = useState<AccountState>({ state: "loading" });
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const generation = useRef(0);
  const revocationTimer = useRef<number>();
  const { data, loading, error } = useQuery(getPublicAccountBasicQuery, {
    variables: { filters: { username: { eq: username } } }, skip: !username, fetchPolicy: "cache-and-network",
  });
  const account = data?.accounts?.[0] as Record<string, any> | undefined;
  const accountId = typeof account?.documentId === "string" ? account.documentId : undefined;

  const invalidate = useCallback(() => {
    generation.current += 1;
    if (revocationTimer.current !== undefined) window.clearTimeout(revocationTimer.current);
    revocationTimer.current = undefined;
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const requestGeneration = ++generation.current;
    if (revocationTimer.current !== undefined) window.clearTimeout(revocationTimer.current);
    revocationTimer.current = undefined;
    const controller = new AbortController();
    const current = resolvedRef.current.accountId === accountId ? resolvedRef.current : undefined;
    const staleDescriptor = current?.descriptor;
    const commit = (next: AccountState) => {
      if (!controller.signal.aborted && generation.current === requestGeneration) setResolved(next);
    };
    if (loading) { if (!staleDescriptor) commit({ accountId, state: "loading" }); return () => controller.abort(); }
    if (error || !accountId) { commit({ accountId, state: "unavailable" }); return () => controller.abort(); }
    if (account?.public_music !== "Yes") { commit({ accountId, state: "not-public" }); return () => controller.abort(); }
    commit({ accountId, state: staleDescriptor ? "revalidating" : "loading", descriptor: staleDescriptor });
    publicMusicClient.discover(accountId, controller.signal).then((descriptor) => commit({ accountId, state: "available", descriptor })).catch((reason: unknown) => {
      const code = reason instanceof PublicMusicError ? reason.code : (reason as { code?: unknown } | null)?.code;
      if (code === "PUBLIC_NOT_FOUND" && staleDescriptor && !controller.signal.aborted && generation.current === requestGeneration) {
        setResolved({ accountId, state: "revoked", descriptor: staleDescriptor });
        revocationTimer.current = window.setTimeout(() => {
          if (generation.current === requestGeneration) setResolved({ accountId, state: "not-public" });
          revocationTimer.current = undefined;
        }, 0);
      } else commit({ accountId, state: code === "PUBLIC_NOT_FOUND" ? "not-public" : "unavailable" });
    });
    return () => { controller.abort(); if (revocationTimer.current !== undefined) window.clearTimeout(revocationTimer.current); revocationTimer.current = undefined; };
  }, [accountId, account?.public_music, attempt, error, loading]);

  useEffect(() => {
    if (resolved.accountId !== accountId || resolved.state !== "available") return;
    const timer = window.setTimeout(invalidate, PUBLIC_MUSIC_DESCRIPTOR_MAX_AGE_MS);
    return () => window.clearTimeout(timer);
  }, [accountId, invalidate, resolved.accountId, resolved.descriptor?.publication.revision, resolved.state]);
  useEffect(() => { window.addEventListener("online", invalidate); return () => window.removeEventListener("online", invalidate); }, [invalidate]);

  const keyed = resolved.accountId === accountId;
  const state: AvailabilityState = keyed ? resolved.state : loading ? "loading" : account?.public_music === "No" ? "not-public" : "loading";
  const descriptor = keyed ? resolved.descriptor : undefined;
  const value = useMemo(() => ({ state, account, descriptor, retry: invalidate }), [account, descriptor, invalidate, state]);
  return <AvailabilityContext.Provider value={value}>{children}</AvailabilityContext.Provider>;
}

export function usePublicMusicAvailability(): Availability {
  return useContext(AvailabilityContext) ?? unavailableOutsideProfileShell;
}
