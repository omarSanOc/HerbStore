import {
  hasUniqueIds,
  isCount,
  isRecord,
  isText,
  mapAll,
} from '../../../core/validation/json-guards.ts';
import { parseCatalogProduct } from '../../product/contracts/parse-catalog-product.ts';
import type {
  HomeBanner,
  HomeCategory,
  HomeData,
  HomeSection,
  HomeSectionId,
} from './home.ts';

// Structural validation without dependencies. Zod belongs to the stack but is not installed yet;
// when it arrives (Day 3/4) this file is the single place to replace.
//
// Policy: the payload is the server's promise, and a malformed element means the promise is
// broken, so the WHOLE payload is invalid (the screen shows an error) instead of silently
// dropping elements. Forward compatibility is the one exception: sections and badges the app
// does not know are ignored, so a newer server does not break an older app.

const SECTION_IDS: readonly HomeSectionId[] = ['best_sellers', 'new', 'offers'];

function parseBanner(value: unknown): HomeBanner | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, title, subtitle, imageUrl, categoryId } = value;

  return isText(id) &&
    isText(title) &&
    typeof subtitle === 'string' &&
    typeof imageUrl === 'string' &&
    isText(categoryId)
    ? { id, title, subtitle, imageUrl, categoryId }
    : undefined;
}

function parseCategory(value: unknown): HomeCategory | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, name, productCount, imageUrl } = value;

  return isText(id) && isText(name) && isCount(productCount) && typeof imageUrl === 'string'
    ? { id, name, productCount, imageUrl }
    : undefined;
}

function parseSection(value: unknown): HomeSection | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, title } = value;
  const items = mapAll(value.items, parseCatalogProduct);

  return SECTION_IDS.includes(id as HomeSectionId) && isText(title) && items !== undefined && hasUniqueIds(items)
    ? { id: id as HomeSectionId, title, items }
    : undefined;
}

function parseSections(value: unknown): HomeSection[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  // Unknown ids are skipped before validating, known ones must be well formed.
  const known = value.filter(
    (section) => !isRecord(section) || SECTION_IDS.includes(section.id as HomeSectionId),
  );

  return mapAll(known, parseSection);
}

/**
 * Validates the decoded JSON of `GET /home`. Returns `HomeData` (a projection of what the screen
 * renders) or `undefined` when the payload does not honour the contract. It never throws and
 * never keeps references to the input.
 */
export function parseHomePayload(payload: unknown): HomeData | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const banners = mapAll(payload.banners, parseBanner);
  const categories = mapAll(payload.categories, parseCategory);
  const sections = parseSections(payload.sections);

  if (
    banners === undefined ||
    categories === undefined ||
    sections === undefined ||
    !hasUniqueIds(banners) ||
    !hasUniqueIds(categories) ||
    !hasUniqueIds(sections)
  ) {
    return undefined;
  }

  return { banners, categories, sections };
}
