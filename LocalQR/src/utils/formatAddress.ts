export interface Address {
  streetNumber: string;
  streetName: string;
  postalCode: string;
  state: string;
  city: string;
  country: string;
}

export function formatAddress(address: Address): string {
  // disabled es-lint because we need an unused variable for key without it it would targetting the key
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return Object.entries(address).reduce((formatted, [_, value]) => {
    // Replace spaces with "+" in the address parts
    const sanitizedValue = value.replace(/ /g, "+");
    return formatted ? `${formatted},${sanitizedValue}` : sanitizedValue;
  }, "");
}

/**
 * Converts a place name to a URL-friendly slug
 * @param name - The place name to convert
 * @returns A kebab-case slug (e.g., "Himachal Pradesh" -> "himachal-pradesh")
 */
export const toUrlSlug = (name: string): string => {
  return name.toLowerCase().replace(/\s+/g, "-");
};
