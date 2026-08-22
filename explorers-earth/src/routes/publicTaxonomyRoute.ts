export function publicTaxonomyPath(
	username: string,
	family: string,
	segment: string,
	documentId: string,
): string {
	return `/${encodeURIComponent(username)}/${family}/${segment}/${encodeURIComponent(documentId)}`;
}

const disabledLegacyTaxonomyLookup = "__PUBLIC_TAXONOMY_LEGACY_LOOKUP_DISABLED__";

export function publicTaxonomyLegacyLookupName(
	routeIdentifier: string,
	reconstructedName: string,
): string {
	return /^[a-z0-9]+$/.test(routeIdentifier)
		? reconstructedName
		: disabledLegacyTaxonomyLookup;
}
