/// <reference types="jest" />
// RF-15 (T6b). A product card has a width of its own (Home's rows grow it up to 1.5x), so its texts cannot
// grow without limit: at iOS AX5 (about 3.1x) the name and the price of a 240 pt card were split in the
// middle of the word ("Complet / e Daily", "$233.8 / 2"). The cap is `fontScaleLimits.cardText`.
//
// Compose: provide a `Density` whose `fontScale` is bounded around the card.
// SwiftUI: `.dynamicTypeSize(...DynamicTypeSize.accessibility2)` on the card.
import { act, fireEvent, screen } from '@testing-library/react-native';

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

// `expo-image` is a native view: a stand-in that records the props, so a test can make the
// picture fail the way the library reports it (`onError`).
const mockImageProps = jest.fn();
jest.mock('expo-image', () => ({
  Image: (props: object) => {
    mockImageProps(props);
    return null;
  },
}));

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

  // RF-32, RF-35 (spec 007, T3). A picture that cannot be loaded (missing file, non-2xx answer,
  // bytes that will not decode) is the only thing that changes: the card keeps its name, its price
  // and its destination, and the fallback text does not become an extra button.
  it('keeps the name, the price and the destination when the picture fails', async () => {
    mockImageProps.mockClear();
    const onPress = jest.fn();
    await renderWithProviders(<ProductCard onPress={onPress} product={product} width={240} />, { language: 'en' });

    // The card is ONE accessible element: the name and the price are spoken together (the price
    // is the USD one converted to the default preference, 1 USD = 18 MXN).
    const card = screen.getByRole('button', { name: /Complete Daily Powder/ });
    expect(card.props.accessibilityLabel).toMatch(/233\.82/);

    await act(async () => {
      mockImageProps.mock.lastCall?.[0].onError(new Error('404'));
    });

    // The fallback is visible inside the frame that stays where it was...
    expect(screen.getByText('Image not available', { includeHiddenElements: true })).toBeOnTheScreen();
    // ...and it is not a second action: the card is still the only button.
    expect(screen.getAllByRole('button')).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: /Complete Daily Powder/ }));

    expect(onPress).toHaveBeenCalledWith('product-261009-001');
  });
});
