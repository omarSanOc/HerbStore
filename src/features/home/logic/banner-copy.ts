/**
 * The two banners of the mock server (`mock-server/src/catalog/home-data.js`), each with a Spanish
 * and an English title and subtitle under `home.banners.items.<id>`. The server sends English
 * text only, so the app translates by id and uses the server text for any id it does not know.
 */
export const KNOWN_BANNER_IDS = ['daily-wellness', 'plant-powered'] as const;

type KnownBannerId = (typeof KNOWN_BANNER_IDS)[number];

/**
 * Translation keys of a banner id, or `undefined` for an unknown id (the caller then shows the
 * server text). The explicit list, instead of building a key from any id, keeps an id such as
 * `constructor` or `__proto__` from resolving to something that is not text.
 */
export function bannerCopyKeys(
  id: string,
): { title: `home.banners.items.${KnownBannerId}.title`; subtitle: `home.banners.items.${KnownBannerId}.subtitle` } | undefined {
  const known = KNOWN_BANNER_IDS.find((candidate) => candidate === id);
  return known === undefined
    ? undefined
    : {
        title: `home.banners.items.${known}.title`,
        subtitle: `home.banners.items.${known}.subtitle`,
      };
}
