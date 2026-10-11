// Category ids are lowercase kebab-case slugs (`vitamins`, `botanicals`): see
// `mock-server/src/catalog/home-data.js`. At most 40 characters, starting with a letter.
const CATEGORY_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

/**
 * Validates a route param before it is shown or sent anywhere. Returns the id when it has the
 * catalog shape, `undefined` otherwise (missing, repeated, padded, uppercase, or with characters
 * that could alter a URL). Whether the category exists is Day 3's concern (the listing).
 */
export function parseCategoryId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return CATEGORY_ID_PATTERN.test(value) ? value : undefined;
}
