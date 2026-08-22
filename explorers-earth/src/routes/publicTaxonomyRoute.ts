export function publicTaxonomyPath(
	username: string,
	family: string,
	segment: string,
	documentId: string,
): string {
	return `/${encodeURIComponent(username)}/${family}/${segment}/${encodeURIComponent(documentId)}`;
}
