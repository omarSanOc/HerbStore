import type { HomeData } from '../contracts/home.ts';

/**
 * Development-only scenarios for cases the real server never produces (it always answers with 2
 * banners, 5 categories and 3 full sections). Selected with `EXPO_PUBLIC_HOME_FIXTURE` in
 * `.env.local`; Metro must restart with `-c` after changing it.
 *
 * - `zero-banners`, `one-banner`, `empty-section`, `all-empty`, `broken-image`: transform the real,
 *   validated answer.
 * - `server-fail`: asks the real server for its simulated 500 (`/home?fail=true`).
 */
export const HOME_FIXTURES = [
  'zero-banners',
  'one-banner',
  'empty-section',
  'all-empty',
  'broken-image',
  'server-fail',
] as const;

export type HomeFixture = (typeof HOME_FIXTURES)[number];

/** Section emptied by `empty-section`: only this one must disappear from the screen. */
const EMPTIED_SECTION = 'new';
/** Kind the server does not know, so every image under it answers 404. */
const BROKEN_IMAGE_PATH = '/images/missing/broken.png';

/**
 * The single gate for fixtures: outside development (`isDev` false) every value is ignored, so a
 * stray variable in a release build changes nothing. Only exact names are accepted.
 */
export function resolveHomeFixture({
  isDev,
  raw,
}: {
  isDev: boolean;
  raw: string | undefined;
}): HomeFixture | undefined {
  return isDev ? HOME_FIXTURES.find((fixture) => fixture === raw) : undefined;
}

/** Pure: returns a new `HomeData`, never mutates `data`. */
export function applyHomeFixture(fixture: HomeFixture, data: HomeData): HomeData {
  switch (fixture) {
    case 'zero-banners':
      return { ...data, banners: [] };
    case 'one-banner':
      return { ...data, banners: data.banners.slice(0, 1) };
    case 'empty-section':
      return {
        ...data,
        sections: data.sections.map((section) =>
          section.id === EMPTIED_SECTION ? { ...section, items: [] } : section,
        ),
      };
    case 'all-empty':
      return { banners: [], categories: [], sections: [] };
    case 'broken-image':
      return {
        banners: data.banners.map((banner) => ({ ...banner, imageUrl: BROKEN_IMAGE_PATH })),
        categories: data.categories.map((category) => ({ ...category, imageUrl: BROKEN_IMAGE_PATH })),
        sections: data.sections.map((section) => ({
          ...section,
          items: section.items.map((item) => ({
            ...item,
            images: item.images.map(() => BROKEN_IMAGE_PATH),
          })),
        })),
      };
    case 'server-fail':
      return data;
  }
}
