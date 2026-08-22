import {
  ApolloLink,
  createHttpLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { getOperationAST, type DocumentNode } from "graphql";

export type ApolloOperationCapability =
  | "auth"
  | "session-only"
  | "public-read"
  | "analytics-write";

export interface ApolloCapabilities {
  publicRead?: string;
  analyticsWrite?: string;
}

interface BrowserCapabilityEnvironment {
  DEV?: boolean;
  VITE_PUBLIC_READ_ACCESS_TOKEN?: string;
  VITE_ANALYTICS_WRITE_ACCESS_TOKEN?: string;
  VITE_PUBLIC_ACCESS_TOKEN?: string;
}

interface SelectAuthorizationInput {
  capability: ApolloOperationCapability;
  sessionToken?: string | null;
  capabilities: ApolloCapabilities;
}

interface CreateApolloTransportOptions {
  uri: string;
  getSessionToken: () => string | null | undefined;
  capabilities: ApolloCapabilities;
}

interface TransportOperationState {
  capability: ApolloOperationCapability;
  usedPublicReadCapability: boolean;
  anonymousRetryAttempted: boolean;
}

const AUTHENTICATION_OPERATIONS = new Set([
  "login",
  "register",
  "forgotPassword",
  "resetPassword",
  "CheckUsernameAvailability",
]);

const ANALYTICS_MUTATIONS = new Map([
  ["CreatePublicPageAnalytic", "createPublicPageAnalytic"],
]);
const TRANSPORT_STATE_CONTEXT_KEY = "apolloTransportState";

function normalizedToken(token: string | null | undefined): string | undefined {
  const value = token?.trim();
  return value || undefined;
}

function withoutAuthorization(headers: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => name.toLowerCase() !== "authorization"),
  );
}

export function classifyApolloOperation(
  operation: { operationName?: string; query: DocumentNode },
): ApolloOperationCapability {
  const operationName = operation.operationName ?? "";
  if (AUTHENTICATION_OPERATIONS.has(operationName)) return "auth";

  const definition = getOperationAST(operation.query, operationName || undefined);
  if (definition?.operation === "query") return "public-read";
  if (definition?.operation !== "mutation") return "session-only";

  const approvedRootField = ANALYTICS_MUTATIONS.get(operationName);
  const rootFields = definition.selectionSet.selections.flatMap((selection) => (
    selection.kind === "Field" ? [selection.name.value] : []
  ));
  return approvedRootField && rootFields.length === 1 && rootFields[0] === approvedRootField
    ? "analytics-write"
    : "session-only";
}

export function selectAuthorization({
  capability,
  sessionToken,
  capabilities,
}: SelectAuthorizationInput): string | undefined {
  if (capability === "auth") return undefined;

  const session = normalizedToken(sessionToken);
  if (session) return `Bearer ${session}`;

  const capabilityToken = capability === "public-read"
    ? capabilities.publicRead
    : capability === "analytics-write"
      ? capabilities.analyticsWrite
      : undefined;
  const normalizedCapability = normalizedToken(capabilityToken);
  return normalizedCapability ? `Bearer ${normalizedCapability}` : undefined;
}

export function resolveBrowserApolloCapabilities(
  environment: BrowserCapabilityEnvironment,
): ApolloCapabilities {
  const legacyLocal = environment.DEV
    ? normalizedToken(environment.VITE_PUBLIC_ACCESS_TOKEN)
    : undefined;

  return {
    publicRead: normalizedToken(environment.VITE_PUBLIC_READ_ACCESS_TOKEN) ?? legacyLocal,
    analyticsWrite: normalizedToken(environment.VITE_ANALYTICS_WRITE_ACCESS_TOKEN) ?? legacyLocal,
  };
}

export function createApolloTransport({
  uri,
  getSessionToken,
  capabilities,
}: CreateApolloTransportOptions): ApolloLink {
  const authorizationLink = setContext((operation, context) => {
    const capability = classifyApolloOperation(operation);
    const previousState = context[TRANSPORT_STATE_CONTEXT_KEY] as
      | TransportOperationState
      | undefined;
    const anonymousRetryAttempted = previousState?.anonymousRetryAttempted ?? false;
    const sessionToken = anonymousRetryAttempted ? undefined : getSessionToken();
    const authorization = selectAuthorization({
      capability,
      sessionToken,
      capabilities: anonymousRetryAttempted
        ? { ...capabilities, publicRead: undefined }
        : capabilities,
    });
    const publicReadAuthorization = normalizedToken(capabilities.publicRead);

    return {
      headers: {
        ...withoutAuthorization(context.headers as Record<string, string> | undefined),
        ...(authorization ? { authorization } : {}),
      },
      [TRANSPORT_STATE_CONTEXT_KEY]: {
        capability,
        usedPublicReadCapability: Boolean(
          capability === "public-read"
          && publicReadAuthorization
          && !normalizedToken(sessionToken)
          && authorization === `Bearer ${publicReadAuthorization}`
          && !anonymousRetryAttempted,
        ),
        anonymousRetryAttempted,
      } satisfies TransportOperationState,
    };
  });

  const anonymousPublicReadRetryLink = onError(({ networkError, operation, forward }) => {
    const status = (networkError as { statusCode?: number; status?: number } | undefined)?.statusCode
      ?? (networkError as { statusCode?: number; status?: number } | undefined)?.status;
    const context = operation.getContext();
    const state = context[TRANSPORT_STATE_CONTEXT_KEY] as TransportOperationState | undefined;

    if (
      status !== 401
      || state?.capability !== "public-read"
      || !state.usedPublicReadCapability
      || state.anonymousRetryAttempted
    ) {
      return;
    }

    operation.setContext({
      ...context,
      headers: withoutAuthorization(context.headers as Record<string, string> | undefined),
      [TRANSPORT_STATE_CONTEXT_KEY]: {
        ...state,
        usedPublicReadCapability: false,
        anonymousRetryAttempted: true,
      } satisfies TransportOperationState,
    });

    return forward(operation);
  });

  return ApolloLink.from([
    anonymousPublicReadRetryLink,
    authorizationLink,
    createHttpLink({ uri }),
  ]);
}
