import type { HomeBanner, HomeCategory, HomeSection, HomeSectionId } from '../contracts/home.ts';
import type { HomeNotice, HomeScreenState } from './classify-home-result.ts';

/**
 * One entry of Home's vertical list. Another discriminated union, now for the list: `kind` says
 * how to draw it and `key` is its stable identity (it never depends on the position).
 */
export type HomeRow =
  | { key: 'notice'; kind: 'notice'; notice: HomeNotice }
  | { key: 'banners'; kind: 'banners'; banners: readonly HomeBanner[] }
  | { key: 'categories'; kind: 'categories'; categories: readonly HomeCategory[] }
  | { key: `section:${HomeSectionId}`; kind: 'section'; section: HomeSection }
  | { key: 'loading'; kind: 'loading' }
  | { key: 'empty' | 'offline' | 'error'; kind: 'status'; status: 'empty' | 'offline' | 'error' };

/**
 * Turns the screen state into the rows to render. Pure: the screen only maps rows to components.
 * Empty collections produce no row (RF-15); the notice goes first so it is seen before the data.
 */
export function buildHomeRows(state: HomeScreenState): HomeRow[] {
  const rows: HomeRow[] = [];

  switch (state.status) {
    case 'loading':
      rows.push({ key: 'loading', kind: 'loading' });
      break;
    case 'empty':
    case 'offline':
    case 'error':
      rows.push({ key: state.status, kind: 'status', status: state.status });
      break;
    case 'ready':
      if (state.notice !== undefined) {
        rows.push({ key: 'notice', kind: 'notice', notice: state.notice });
      }
      if (state.data.banners.length > 0) {
        rows.push({ key: 'banners', kind: 'banners', banners: state.data.banners });
      }
      if (state.data.categories.length > 0) {
        rows.push({ key: 'categories', kind: 'categories', categories: state.data.categories });
      }
      for (const section of state.data.sections) {
        if (section.items.length > 0) {
          rows.push({ key: `section:${section.id}`, kind: 'section', section });
        }
      }
      break;
  }

  return rows;
}
