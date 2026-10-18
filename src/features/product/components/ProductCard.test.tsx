/// <reference types="jest" />
// RF-15 (T6b). A product card has a width of its own (Home's rows grow it up to 1.5x), so its texts cannot
// grow without limit: at iOS AX5 (about 3.1x) the name and the price of a 240 pt card were split in the
// middle of the word ("Complet / e Daily", "$233.8 / 2"). The cap is `fontScaleLimits.cardText`.
//
// Compose: provide a `Density` whose `fontScale` is bounded around the card.
// SwiftUI: `.dynamicTypeSize(...DynamicTypeSize.accessibility2)` on the card.
import { screen } from '@testing-library/react-native';

import { fontScaleLimits } from '@/design-system';
import { renderWithProviders } from '@/test/render-with-providers';

import type { CatalogProduct } from '../contracts/catalog-product';
import { ProductCard } from './ProductCard';

const product = {
  id: 'product-261009-001',
  ean13: '2002610090011',
  brand: 'AsterVale Nutrition',
  name: 'Complete Daily Powder',
  categoryId: 'vitamins',
  subcategoryId: 'multivitamins',
  price: 12.99,
  listPrice: 15.59,
  currency: 'USD',
  rating: 3.1,
  reviewCount: 815,
  soldLast30Days: 504,
  badges: ['NEW'],
  images: ['/images/products/product-261009-001.png'],
} as unknown as CatalogProduct;

describe('ProductCard', () => {
  it('caps the font scale of the name, the price, the previous price and the rating', async () => {
    await renderWithProviders(<ProductCard onPress={jest.fn()} product={product} width={240} />, { language: 'en' });

    for (const text of [/Complete Daily Powder/, /\$\d/, /★ 3\.1/]) {
      for (const node of screen.getAllByText(text, { includeHiddenElements: true })) {
        expect(node).toHaveProp('maxFontSizeMultiplier', fontScaleLimits.cardText);
      }
    }
    expect(fontScaleLimits.cardText).toBe(2);
  });
});
