import {
  ApolloLink,
  createHttpLink,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import {
  Kind,
  OperationTypeNode,
  type DocumentNode,
  type OperationDefinitionNode,
} from "graphql";

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

const AUTHENTICATION_OPERATIONS = new Map<string, {
  kind: OperationTypeNode;
  rootField: string;
}>([
  ["login", { kind: OperationTypeNode.MUTATION, rootField: "login" }],
  ["register", { kind: OperationTypeNode.MUTATION, rootField: "register" }],
  ["forgotPassword", { kind: OperationTypeNode.MUTATION, rootField: "forgotPassword" }],
  ["resetPassword", { kind: OperationTypeNode.MUTATION, rootField: "resetPassword" }],
  ["CheckUsernameAvailability", { kind: OperationTypeNode.QUERY, rootField: "accounts" }],
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

function selectOperationDefinition(
  document: DocumentNode,
  operationName?: string,
): OperationDefinitionNode | undefined {
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode => (
      definition.kind === Kind.OPERATION_DEFINITION
    ),
  );
  const matchingOperations = operationName
    ? operations.filter((definition) => definition.name?.value === operationName)
    : operations;

  return matchingOperations.length === 1 ? matchingOperations[0] : undefined;
}

function soleDirectRootField(
  definition: OperationDefinitionNode,
): string | undefined {
  const selections = definition.selectionSet.selections;
  if (selections.length !== 1 || selections[0]?.kind !== Kind.FIELD) return undefined;
  return selections[0].name.value;
}

export function classifyApolloOperation(
  operation: { operationName?: string; query: DocumentNode },
): ApolloOperationCapability {
  const definition = selectOperationDefinition(operation.query, operation.operationName);
  if (!definition) return "session-only";

  const operationName = definition.name?.value ?? "";
  const authContract = AUTHENTICATION_OPERATIONS.get(operationName);
  if (authContract) {
    return definition.operation === authContract.kind
      && soleDirectRootField(definition) === authContract.rootField
      ? "auth"
      : "session-only";
  }

  if (definition?.operation === "query") return "public-read";
  if (definition?.operation !== "mutation") return "session-only";

  const approvedRootField = ANALYTICS_MUTATIONS.get(operationName);
  return approvedRootField && soleDirectRootField(definition) === approvedRootField
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
