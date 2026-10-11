/** The five categories of the mock catalog, each with a translation under `home.categories`. */
export const KNOWN_CATEGORY_IDS = ['vitamins', 'minerals', 'protein', 'botanicals', 'wellness'] as const;

/**
 * Translation key for a category id, or `undefined` when the id has no translation: the caller
 * then shows the text sent by the server. The explicit list (instead of building the key from any
 * id) keeps an unexpected id such as `constructor` from resolving to something that is not text.
 */
export function categoryLabelKey(
  id: string,
): `home.categories.${(typeof KNOWN_CATEGORY_IDS)[number]}` | undefined {
  const known = KNOWN_CATEGORY_IDS.find((candidate) => candidate === id);
  return known === undefined ? undefined : `home.categories.${known}`;
}

/**
 * First visible character of a name, uppercased: what a circular category shows when its image
 * cannot load. `Array.from` iterates by code point, so an emoji is not cut in half.
 */
export function categoryInitial(name: string): string {
  const [first] = Array.from(name.trim());
  return first === undefined ? '?' : first.toLocaleUpperCase();
}
