export type PublicChildState =
	| "loading"
	| "error"
	| "redirect"
	| "empty"
	| "ready";

export interface PublicChildStateInput {
	loading: boolean;
	error: unknown;
	bootstrapReady: boolean;
	resourceKind: "collection" | "child";
	entityExists: boolean;
	empty: boolean;
}

/**
 * Classifies a public collection or child after its current route lookup.
 * Presentation remains the responsibility of usePublicRouteLifecycle.
 */
export function resolvePublicChildState(
	input: PublicChildStateInput,
): PublicChildState {
	if (input.loading || !input.bootstrapReady) return "loading";
	if (input.error) return "error";
	if (input.resourceKind === "child" && !input.entityExists) return "redirect";
	if (input.empty) return "empty";
	return "ready";
}
