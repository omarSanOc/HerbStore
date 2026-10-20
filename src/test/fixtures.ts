import { persistStore } from 'redux-persist';

import { createAppStore } from '@/core/store/create-app-store';
import { createSafeStorage, type KeyValueBackend } from '@/core/storage/persist-storage';
import type { SupportedLanguage } from '@/core/i18n/languages';

/** Fictional wire data (server shape). No real brands, people or addresses. */

export type WireProduct = Record<string, unknown>;

/** One product as `GET /products` and `GET /products/:id` send it; `extra` overrides fields. */
export function wireProduct(index: number, extra: WireProduct = {}): WireProduct {
  const n = String(index).padStart(3, '0');
  return {
    id: `product-261009-${n}`,
    ean13: `200261009${String(index).padStart(4, '0')}`,
    brand: 'AsterVale Nutrition',
    name: `Complete Daily Powder ${n}`,
    categoryId: 'vitamins',
    subcategoryId: 'multivitamins',
    price: 12.99,
    currency: 'USD',
    rating: 4.2,
    reviewCount: 120,
    soldLast30Days: 50,
    badges: ['NEW'],
    inStock: true,
    isOwnBrand: false,
    subscribeAndSave: false,
    images: [`/images/products/product-${n}-front.png`],
    servingInfo: { size: '1 scoop (20 g)', servingsPerContainer: 29 },
    description: 'A fictional product.',
    ...extra,
  };
}

/** `GET /products` page with `count` items. */
export function wireProductPage(count: number, extra: WireProduct = {}): WireProduct {
  return {
    items: Array.from({ length: count }, (_, i) => wireProduct(i + 1)),
    page: 1,
    totalPages: count === 0 ? 0 : 1,
    total: count,
    ...extra,
  };
}

/** `GET /brands` body. */
export function wireBrands(): WireProduct[] {
  return [
    { name: 'AsterVale Nutrition', productCount: 12 },
    { name: 'Fernlight Labs', productCount: 8 },
  ];
}

/**
 * Copy of `GET /categories` in the two languages the API serves (RF-9, RF-22): names come
 * localized with `Content-Language`, so the controlled answer carries them localized too.
 */
const CATEGORY_COPY = {
  en: { name: 'Vitamins', subcategory: 'Multivitamins' },
  es: { name: 'Vitaminas', subcategory: 'Multivitamínicos' },
} as const;

/** `GET /categories` body: the tree the category screen and the advanced-filters sheet read. */
export function wireCategories(language: SupportedLanguage = 'en'): WireProduct[] {
  const copy = CATEGORY_COPY[language];
  return [
    {
      id: 'vitamins',
      name: copy.name,
      productCount: 12,
      subcategories: [{ id: 'multivitamins', name: copy.subcategory, productCount: 12 }],
    },
  ];
}

type MemoryStorageOptions = Readonly<{
  /** Seed values, keyed like redux-persist does (`persist:root`). */
  initial?: Readonly<Record<string, string>>;
  /** Reads wait until `releaseReads()`: keeps a store "restoring" (cart locked) on demand. */
  holdReads?: boolean;
}>;

/** An in-memory redux-persist engine: the real safe adapter over a `Map` (no MMKV, no disk). */
export function createMemoryStorage({ initial = {}, holdReads = false }: MemoryStorageOptions = {}) {
  const data = new Map(Object.entries(initial));
  const backend: KeyValueBackend = {
    getString: (key) => data.get(key),
    set: (key, value) => void data.set(key, value),
    remove: (key) => data.delete(key),
  };
  const safe = createSafeStorage(() => backend);
  let releaseReads: () => void = () => undefined;
  const gate = holdReads ? new Promise<void>((resolve) => (releaseReads = resolve)) : Promise.resolve();

  return {
    getItem: (key: string) => gate.then(() => safe.getItem(key)),
    setItem: safe.setItem,
    removeItem: safe.removeItem,
    /** What is stored right now, for assertions about what reached "disk". */
    data,
    releaseReads: () => releaseReads(),
  };
}

type TestStoreOptions = Omit<Parameters<typeof createAppStore>[0], 'storage' | 'persistTimeoutMs'> &
  Readonly<{ storage?: Parameters<typeof createAppStore>[0]['storage'] }>;

/**
 * A fresh app store per test with an in-memory storage. It does not read the storage until
 * `startPersistence(store)` runs, so `state._persist` does not even exist yet.
 */
export function createTestStore({ storage = createMemoryStorage(), preloadedState }: TestStoreOptions = {}) {
  return createAppStore({ storage, preloadedState, persistTimeoutMs: 0 });
}

/**
 * What the app does at import time (`persistStore(store)`): after this `_persist.rehydrated` is
 * `false` (the cart is locked) until the storage answers; `rehydrated` resolves when it has.
 */
export function startPersistence(store: ReturnType<typeof createTestStore>) {
  let markRehydrated: () => void = () => undefined;
  const rehydrated = new Promise<void>((resolve) => (markRehydrated = resolve));
  const persistor = persistStore(store, null, () => markRehydrated());
  return { persistor, rehydrated };
}
