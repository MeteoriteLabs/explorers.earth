export function shouldRedirectMissingPublicResource({
  loading,
  error,
  resource,
}: {
  loading: boolean;
  error: unknown;
  resource: unknown;
}): boolean {
  return !loading && !error && resource == null;
}
