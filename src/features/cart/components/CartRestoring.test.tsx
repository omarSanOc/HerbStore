/// <reference types="jest" />
// RF-15 (spec 006, T6c). "Restoring cart" is a blocking state with its own text. With reduced motion the
// spinner is left out and the text stands alone, as in the footer of a product list (Day 3): an
// indeterminate spinner is an endless movement the user asked not to see, and the title and the message
// already say what is happening.
//
// Android: `ProgressBar` indeterminate vs a static `TextView`; iOS: `UIActivityIndicatorView` vs a label;
// Compose: `CircularProgressIndicator` guarded by `LocalReduceMotion`-style checks.
import { screen } from '@testing-library/react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { renderWithProviders } from '@/test/render-with-providers';

import { CartRestoring } from './CartRestoring';

jest.mock('@/core/accessibility/use-reduced-motion', () => ({ useReducedMotionPreference: jest.fn(() => false) }));

const isSpinnerDrawn = () => JSON.stringify(screen.toJSON()).includes('"type":"ActivityIndicator"');

describe('CartRestoring and reduced motion', () => {
  beforeEach(() => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(false);
  });

  it('WITH MOTION: a spinner, the title and the message', async () => {
    await renderWithProviders(<CartRestoring />);

    expect(isSpinnerDrawn()).toBe(true);
    expect(screen.getByRole('header', { name: 'Restaurando carrito…' })).toBeOnTheScreen();
  });

  it('REDUCED MOTION: no spinner; the title and the message stand alone', async () => {
    jest.mocked(useReducedMotionPreference).mockReturnValue(true);
    await renderWithProviders(<CartRestoring />);

    expect(isSpinnerDrawn()).toBe(false);
    expect(screen.getByRole('header', { name: 'Restaurando carrito…' })).toBeOnTheScreen();
    expect(screen.getByText('Espera un momento mientras recuperamos tus productos.')).toBeOnTheScreen();
  });
});
