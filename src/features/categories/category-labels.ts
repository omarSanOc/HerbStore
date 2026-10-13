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
 * Translation key (`subcategories.*`) of each subcategory of the mock catalog, by server id. Fifteen:
 * three in each of the five categories. The key is camelCase because an id such as `vitamin-c`
 * is not a pleasant object property in the resource files.
 */
const SUBCATEGORY_LABEL_KEYS = {
  multivitamins: 'subcategories.multivitamins',
  'vitamin-c': 'subcategories.vitaminC',
  'vitamin-d': 'subcategories.vitaminD',
  magnesium: 'subcategories.magnesium',
  zinc: 'subcategories.zinc',
  calcium: 'subcategories.calcium',
  'plant-protein': 'subcategories.plantProtein',
  'whey-protein': 'subcategories.wheyProtein',
  'amino-blends': 'subcategories.aminoBlends',
  'herbal-blends': 'subcategories.herbalBlends',
  'mushroom-blends': 'subcategories.mushroomBlends',
  'root-extracts': 'subcategories.rootExtracts',
  probiotics: 'subcategories.probiotics',
  omegas: 'subcategories.omegas',
  'sleep-support': 'subcategories.sleepSupport',
} as const;

type KnownSubcategoryId = keyof typeof SUBCATEGORY_LABEL_KEYS;

export const KNOWN_SUBCATEGORY_IDS = Object.keys(SUBCATEGORY_LABEL_KEYS) as KnownSubcategoryId[];

/**
 * Translation key for a subcategory id, or `undefined` for any id that is not one of the 15 known:
 * the caller then shows the text the server sent (and, failing that, the value itself). Searching
 * the explicit list (instead of indexing the object with the id) keeps a name such as
 * `constructor` from resolving to something that is not text.
 */
export function subcategoryLabelKey(
  id: string,
): (typeof SUBCATEGORY_LABEL_KEYS)[KnownSubcategoryId] | undefined {
  const known = KNOWN_SUBCATEGORY_IDS.find((candidate) => candidate === id);
  return known === undefined ? undefined : SUBCATEGORY_LABEL_KEYS[known];
}

/**
 * First visible character of a name, uppercased: what a circular category shows when its image
 * cannot load. `Array.from` iterates by code point, so an emoji is not cut in half.
 */
export function categoryInitial(name: string): string {
  const [first] = Array.from(name.trim());
  return first === undefined ? '?' : first.toLocaleUpperCase();
}
