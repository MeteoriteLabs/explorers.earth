import { gql, useQuery } from "@apollo/client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams } from "react-router-dom";

import type { PublicRouteVisibilityField } from "../routes/publicRouteContract";

export type PublicProfileBootstrapAccount = {
  documentId: string;
  Account_Name?: string | null;
  Account_Type?: string | null;
  Primary_Address?: { address?: string | null } | null;
  bg_picture?: { url?: string | null } | null;
  profile_picture?: { url?: string | null } | null;
  social_media?: Record<string, unknown> | null;
  localtunes_public?: boolean | null;
  pinned_nav_tabs?: unknown;
  auto_pinning?: boolean | null;
} & Partial<Record<PublicRouteVisibilityField, "Yes" | "No" | null>>;

type BootstrapBase = {
  bootstrapKey: string;
};

export type PublicProfileBootstrapValue =
  | (BootstrapBase & { status: "loading" })
  | (BootstrapBase & { status: "not-found" })
  | (BootstrapBase & {
      status: "error";
      error: unknown;
      retrying: boolean;
      retry: () => Promise<void>;
    })
  | (BootstrapBase & {
      status: "ready";
      account: PublicProfileBootstrapAccount;
      refreshing: boolean;
      refreshError?: unknown;
      retrying: boolean;
      retry: () => Promise<void>;
    });

export const publicProfileBootstrapQuery = gql`
  query PublicProfileBootstrap($filters: AccountFiltersInput) {
    accounts(filters: $filters) {
      documentId
      Account_Name
      Account_Type
      Primary_Address
      bg_picture {
        url
      }
      profile_picture {
        url
      }
      social_media
      localtunes_public
      public_profile
      public_recommendations
      public_music
      public_movie
      public_books
      public_guides
      public_games
      public_apps
      public_products
      public_people
      pinned_nav_tabs
      auto_pinning
    }
  }
`;

export const PublicProfileBootstrapContext =
  createContext<PublicProfileBootstrapValue | null>(null);

export function normalizePublicProfileBootstrapKey(username: string | undefined): string {
  return username?.trim().toLocaleLowerCase() ?? "";
}

export function PublicProfileBootstrapProvider({ children }: { children: ReactNode }) {
  const { username } = useParams<{ username: string }>();
  const bootstrapKey = normalizePublicProfileBootstrapKey(username);
  const currentBootstrapKeyRef = useRef(bootstrapKey);
  currentBootstrapKeyRef.current = bootstrapKey;
  const [retryState, setRetryState] = useState({
    bootstrapKey,
    retrying: false,
  });
  const retryInFlightRef = useRef<{
    bootstrapKey: string;
    operation: Promise<void>;
  } | null>(null);
  const retryOwnerByKeyRef = useRef(new Map<string, Promise<void>>());
  const retrying =
    retryState.bootstrapKey === bootstrapKey && retryState.retrying;

  const { data, loading, error, refetch } = useQuery<{
    accounts?: PublicProfileBootstrapAccount[];
  }>(publicProfileBootstrapQuery, {
    variables: {
      filters: {
        username: {
          eq: bootstrapKey,
        },
      },
    },
    skip: !bootstrapKey,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const retry = useCallback(() => {
    const retryKey = bootstrapKey;
    if (retryInFlightRef.current?.bootstrapKey === retryKey) {
      return retryInFlightRef.current.operation;
    }

    // Assigned before the first awaited completion and captured for promise identity.
    let operation!: Promise<void>;
    // eslint-disable-next-line prefer-const
    operation = (async () => {
      setRetryState({ bootstrapKey: retryKey, retrying: true });
      try {
        await refetch();
      } finally {
        const ownsRetryKey = retryOwnerByKeyRef.current.get(retryKey) === operation;
        if (retryInFlightRef.current?.operation === operation) {
          retryInFlightRef.current = null;
        }
        if (ownsRetryKey) {
          retryOwnerByKeyRef.current.delete(retryKey);
        }
        if (ownsRetryKey && currentBootstrapKeyRef.current === retryKey) {
          setRetryState({ bootstrapKey: retryKey, retrying: false });
        }
      }
    })();

    retryInFlightRef.current = { bootstrapKey: retryKey, operation };
    retryOwnerByKeyRef.current.set(retryKey, operation);
    return operation;
  }, [bootstrapKey, refetch]);

  const value = useMemo<PublicProfileBootstrapValue>(() => {
    const account = data?.accounts?.[0];

    if (account) {
      return {
        bootstrapKey,
        status: "ready",
        account,
        refreshing: loading,
        refreshError: error,
        retrying,
        retry,
      };
    }

    if (error) {
      return { bootstrapKey, status: "error", error, retrying, retry };
    }

    if (!loading && data) {
      return { bootstrapKey, status: "not-found" };
    }

    return { bootstrapKey, status: "loading" };
  }, [bootstrapKey, data, error, loading, retry, retrying]);

  return (
    <PublicProfileBootstrapContext.Provider value={value}>
      {children}
    </PublicProfileBootstrapContext.Provider>
  );
}

export function usePublicProfileBootstrap(): PublicProfileBootstrapValue {
  const context = useContext(PublicProfileBootstrapContext);
  if (!context) {
    throw new Error(
      "usePublicProfileBootstrap must be used within a PublicProfileBootstrapProvider",
    );
  }
  return context;
}

export function usePublicProfileBootstrapAccount(): PublicProfileBootstrapAccount {
  const bootstrap = usePublicProfileBootstrap();
  if (bootstrap.status !== "ready") {
    throw new Error("Public profile route content requires a ready bootstrap account");
  }
  return bootstrap.account;
}
