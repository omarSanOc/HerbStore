import type { HomeData } from '../contracts/home.ts';

/** A payload shaped like the real `GET /home` (extra product fields included on purpose). */
export function wirePayload(): Record<string, unknown> {
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
        title: 'Daily wellness essentials',
        subtitle: 'Explore fictional products for everyday routines.',
        imageUrl: '/images/banners/daily-wellness.png',
        categoryId: 'vitamins',
      },
      {
        id: 'plant-powered',
        title: 'Plant-powered collection',
        subtitle: 'Discover botanical and plant protein formulas.',
        imageUrl: '/images/banners/plant-powered.png',
        categoryId: 'botanicals',
      },
    ],
    categories: [
      { id: 'vitamins', name: 'Vitamins', productCount: 60, imageUrl: '/images/categories/vitamins.png' },
      { id: 'minerals', name: 'Minerals', productCount: 60, imageUrl: '/images/categories/minerals.png' },
    ],
    sections: [
      { id: 'best_sellers', title: 'Best sellers', items: [product(1), product(2)] },
      { id: 'new', title: 'New', items: [product(3)] },
      {
        id: 'offers',
        title: 'Offers',
        items: [product(4, { listPrice: 15.59, couponText: 'Save 10% at checkout', currency: 'MXN' })],
      },
    ],
  };
}

/** The same data after validation, as the app holds it. */
export function homeData(): HomeData {
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
        title: 'Daily wellness essentials',
        subtitle: 'Explore fictional products for everyday routines.',
        imageUrl: '/images/banners/daily-wellness.png',
        categoryId: 'vitamins',
      },
      {
        id: 'plant-powered',
        title: 'Plant-powered collection',
        subtitle: 'Discover botanical and plant protein formulas.',
        imageUrl: '/images/banners/plant-powered.png',
        categoryId: 'botanicals',
      },
    ],
    categories: [
      { id: 'vitamins', name: 'Vitamins', productCount: 60, imageUrl: '/images/categories/vitamins.png' },
      { id: 'minerals', name: 'Minerals', productCount: 60, imageUrl: '/images/categories/minerals.png' },
    ],
    sections: [
      { id: 'best_sellers', title: 'Best sellers', items: [product(1), product(2)] },
      { id: 'new', title: 'New', items: [product(3)] },
      {
        id: 'offers',
        title: 'Offers',
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
