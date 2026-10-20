import type { SupportedLanguage } from '../../../core/i18n/languages.ts';
import type { HomeData } from '../contracts/home.ts';

/**
 * Copy of the catalog in the two languages the API serves (RF-8, RF-22): banner titles and
 * subtitles, category names and section titles come localized from `GET /home`, so a controlled
 * answer has to carry them too. This table lives ONLY in tests; the app never imports it, and the
 * product data below is the same in both languages on purpose (only the copy of Home is under test).
 */
const COPY = {
  es: {
    banners: [
      {
        title: 'Esenciales de bienestar diario',
        subtitle: 'Explora productos ficticios para las rutinas de cada día.',
      },
      {
        title: 'Colección de origen vegetal',
        subtitle: 'Descubre fórmulas botánicas y proteínas vegetales.',
      },
    ],
    categories: { vitamins: 'Vitaminas', minerals: 'Minerales' },
    sections: { best_sellers: 'Más vendidos', new: 'Nuevos', offers: 'Ofertas' },
  },
  en: {
    banners: [
      {
        title: 'Daily wellness essentials',
        subtitle: 'Explore fictional products for everyday routines.',
      },
      {
        title: 'Plant-powered collection',
        subtitle: 'Discover botanical and plant protein formulas.',
      },
    ],
    categories: { vitamins: 'Vitamins', minerals: 'Minerals' },
    sections: { best_sellers: 'Best sellers', new: 'New', offers: 'Offers' },
  },
} as const;

/** A payload shaped like the real `GET /home` (extra product fields included on purpose). */
export function wirePayload(language: SupportedLanguage = 'en'): Record<string, unknown> {
  const copy = COPY[language];
  const product = (index: number, extra: Record<string, unknown> = {}) => ({
    id: `product-261009-${String(index).padStart(3, '0')}`,
    ean13: `200261009${String(index).padStart(4, '0')}`,
    brand: 'AsterVale Nutrition',
    name: 'Complete Daily Powder',
    categoryId: 'vitamins',
    subcategoryId: 'multivitamins',
    price: 12.99,
    currency: 'USD',
    rating: 3.1,
    reviewCount: 815,
    soldLast30Days: 504,
    badges: ['NEW'],
    inStock: true,
    isOwnBrand: false,
    subscribeAndSave: false,
    images: [
      `/images/products/product-${String(index).padStart(3, '0')}-front.png`,
      `/images/products/product-${String(index).padStart(3, '0')}-detail.png`,
    ],
    servingInfo: { size: '1 scoop (20 g)', servingsPerContainer: 29 },
    description: 'A fictional product.',
    ...extra,
  });

  return {
    banners: [
      {
        id: 'daily-wellness',
        title: copy.banners[0].title,
        subtitle: copy.banners[0].subtitle,
        imageUrl: '/images/banners/daily-wellness.png',
        categoryId: 'vitamins',
      },
      {
        id: 'plant-powered',
        title: copy.banners[1].title,
        subtitle: copy.banners[1].subtitle,
        imageUrl: '/images/banners/plant-powered.png',
        categoryId: 'botanicals',
      },
    ],
    categories: [
      { id: 'vitamins', name: copy.categories.vitamins, productCount: 60, imageUrl: '/images/categories/vitamins.png' },
      { id: 'minerals', name: copy.categories.minerals, productCount: 60, imageUrl: '/images/categories/minerals.png' },
    ],
    sections: [
      { id: 'best_sellers', title: copy.sections.best_sellers, items: [product(1), product(2)] },
      { id: 'new', title: copy.sections.new, items: [product(3)] },
      {
        id: 'offers',
        title: copy.sections.offers,
        items: [product(4, { listPrice: 15.59, couponText: 'Save 10% at checkout', currency: 'MXN' })],
      },
    ],
  };
}

/** The same data after validation, as the app holds it. */
export function homeData(language: SupportedLanguage = 'en'): HomeData {
  const copy = COPY[language];
  const product = (index: number) => ({
    id: `product-261009-${String(index).padStart(3, '0')}`,
    brand: 'AsterVale Nutrition',
    name: 'Complete Daily Powder',
    categoryId: 'vitamins',
    subcategoryId: 'multivitamins',
    price: 12.99,
    currency: 'USD' as const,
    rating: 3.1,
    reviewCount: 815,
    soldLast30Days: 504,
    badges: ['NEW' as const],
    inStock: true,
    images: [
      `/images/products/product-${String(index).padStart(3, '0')}-front.png`,
      `/images/products/product-${String(index).padStart(3, '0')}-detail.png`,
    ],
  });

  return {
    banners: [
      {
        id: 'daily-wellness',
        title: copy.banners[0].title,
        subtitle: copy.banners[0].subtitle,
        imageUrl: '/images/banners/daily-wellness.png',
        categoryId: 'vitamins',
      },
      {
        id: 'plant-powered',
        title: copy.banners[1].title,
        subtitle: copy.banners[1].subtitle,
        imageUrl: '/images/banners/plant-powered.png',
        categoryId: 'botanicals',
      },
    ],
    categories: [
      { id: 'vitamins', name: copy.categories.vitamins, productCount: 60, imageUrl: '/images/categories/vitamins.png' },
      { id: 'minerals', name: copy.categories.minerals, productCount: 60, imageUrl: '/images/categories/minerals.png' },
    ],
    sections: [
      { id: 'best_sellers', title: copy.sections.best_sellers, items: [product(1), product(2)] },
      { id: 'new', title: copy.sections.new, items: [product(3)] },
      {
        id: 'offers',
        title: copy.sections.offers,
        items: [
          {
            ...product(4),
            currency: 'MXN',
            listPrice: 15.59,
            couponText: 'Save 10% at checkout',
          },
        ],
      },
    ],
  };
}
