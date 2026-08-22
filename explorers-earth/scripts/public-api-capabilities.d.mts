export interface PublicApiCapability {
  id: string;
  operationName: string;
  enabledField?: string;
  query: string;
  variables: (...args: string[]) => Record<string, string>;
  path: string[];
  runtimeOperationNames: readonly string[];
}

export const ACCOUNT_BOOTSTRAP: PublicApiCapability;
export const PUBLIC_COLLECTION_OPERATIONS: readonly PublicApiCapability[];
export const PUBLIC_RUNTIME_OPERATION_CAPABILITIES: ReadonlyMap<string, string>;
export function enabledPublicOperations(account: Record<string, unknown>): PublicApiCapability[];
