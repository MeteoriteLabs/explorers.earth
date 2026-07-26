/**
 * Rating values can arrive as numbers, numeric strings ("8.8"), empty strings,
 * null, or undefined because they are persisted verbatim inside Strapi JSON
 * blobs (Place_Details.Rating, etc.). Rendering `value.toFixed(1)` directly
 * crashes the public pages when the value is a string. These helpers make the
 * "is this a real, displayable number?" check explicit.
 *
 * NOTE: Number("") and Number(null) are BOTH 0, so we must reject empty/blank
 * and nullish values BEFORE coercing — otherwise a missing rating renders "0.0".
 */
export const isDisplayableNumber = (value: unknown): boolean =>
  typeof value === "number"
    ? Number.isFinite(value)
    : typeof value === "string" &&
      value.trim() !== "" &&
      Number.isFinite(Number(value));

/** Coerce a known-displayable value to a number. Guard with isDisplayableNumber first. */
export const toDisplayNumber = (value: unknown): number => Number(value);
