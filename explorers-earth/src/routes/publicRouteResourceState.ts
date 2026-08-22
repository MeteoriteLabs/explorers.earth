import { resolvePublicChildState } from "./resolvePublicChildState";

/**
 * Temporary Task 2 compatibility adapter. The authoritative classification is
 * resolvePublicChildState; callers migrate to it family by family.
 */
export function shouldRedirectMissingPublicResource({
  loading,
  error,
  resource,
}: {
  loading: boolean;
  error: unknown;
  resource: unknown;
}): boolean {
  return resolvePublicChildState({
    loading,
    error,
    bootstrapReady: true,
    resourceKind: "child",
    entityExists: resource != null,
    empty: false,
  }) === "redirect";
}
