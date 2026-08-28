import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@apollo/client";
import { useParams } from "react-router-dom";
import { getPublicAccountBasicQuery } from "../PublicHome/api/query";
import { publicMusicClient, PublicMusicError, type PublicMusicDescriptor } from "./publicMusicClient";

type AvailabilityState = "loading" | "available" | "not-public" | "unavailable";
type Availability = { state: AvailabilityState; account?: Record<string, any>; descriptor?: PublicMusicDescriptor; retry: () => void };
const AvailabilityContext = createContext<Availability | null>(null);
const unavailableOutsideProfileShell: Availability = { state: "unavailable", retry: () => undefined };

export function PublicMusicAvailabilityProvider({ children }: { children: ReactNode }) {
  const { username } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [descriptor, setDescriptor] = useState<PublicMusicDescriptor>();
  const [descriptorState, setDescriptorState] = useState<AvailabilityState>("loading");
  const { data, loading, error } = useQuery(getPublicAccountBasicQuery, {
    variables: { filters: { username: { eq: username } } }, skip: !username, fetchPolicy: "cache-and-network",
  });
  const account = data?.accounts?.[0] as Record<string, any> | undefined;

  useEffect(() => {
    const controller = new AbortController();
    setDescriptor(undefined);
    if (loading) { setDescriptorState("loading"); return () => controller.abort(); }
    if (error || !account?.documentId) { setDescriptorState("unavailable"); return () => controller.abort(); }
    if (account.public_music !== "Yes") { setDescriptorState("not-public"); return () => controller.abort(); }
    setDescriptorState("loading");
    publicMusicClient.discover(account.documentId, controller.signal).then((value) => {
      if (!controller.signal.aborted) { setDescriptor(value); setDescriptorState("available"); }
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) setDescriptorState(reason instanceof PublicMusicError && reason.code === "PUBLIC_NOT_FOUND" ? "not-public" : "unavailable");
    });
    return () => controller.abort();
  }, [account?.documentId, account?.public_music, attempt, error, loading]);

  useEffect(() => {
    const invalidate = () => setAttempt((value) => value + 1);
    window.addEventListener("online", invalidate);
    return () => window.removeEventListener("online", invalidate);
  }, []);

  const value = useMemo(() => ({ state: descriptorState, account, descriptor, retry: () => setAttempt((v) => v + 1) }), [account, descriptor, descriptorState]);
  return <AvailabilityContext.Provider value={value}>{children}</AvailabilityContext.Provider>;
}

export function usePublicMusicAvailability(): Availability {
  return useContext(AvailabilityContext) ?? unavailableOutsideProfileShell;
}
