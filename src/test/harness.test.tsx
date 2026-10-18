/// <reference types="jest" />
import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useAppSelector } from '@/core/store/hooks';
import { productAdded } from '@/features/cart/store/cart-slice';
import { useAppTheme } from '@/design-system';
import { useTranslation } from 'react-i18next';

import { createMemoryStorage, createTestStore, startPersistence } from './fixtures';
import { renderWithProviders } from './render-with-providers';

function Probe() {
  const { t } = useTranslation();
  const { scheme } = useAppTheme();
  const lines = useAppSelector((state) => state.cart.lines.length);
  return (
    <Text>{`${t('notFound.goHome')} | ${scheme} | lines:${lines}`}</Text>
  );
}

describe('renderWithProviders', () => {
  it('renders in Spanish by default', async () => {
    await renderWithProviders(<Probe />);
    expect(screen.getByText(/^Ir a Inicio \| light \| lines:0$/)).toBeOnTheScreen();
  });

  it('renders in English when asked', async () => {
    await renderWithProviders(<Probe />, { language: 'en' });
    expect(screen.getByText(/^Go to Home \| light/)).toBeOnTheScreen();
  });

  it('resets the language between tests', async () => {
    await renderWithProviders(<Probe />);
    expect(screen.getByText(/^Ir a Inicio/)).toBeOnTheScreen();
  });

  it('applies the dark theme', async () => {
    await renderWithProviders(<Probe />, { colorScheme: 'dark' });
    expect(screen.getByText(/\| dark \|/)).toBeOnTheScreen();
  });

  it('gives each render its own in-memory store', async () => {
    const first = createTestStore();
    const second = createTestStore();
    expect(first).not.toBe(second);
    first.dispatch(
      productAdded({
        product: {
          productId: 'product-261009-001',
          name: 'Complete Daily Powder',
          unitPrice: 1299,
          currency: 'MXN',
          stock: 5,
        },
        quantity: 1,
      }),
    );
    expect(first.getState().cart.lines).toHaveLength(1);
    expect(second.getState().cart.lines).toHaveLength(0);

    await renderWithProviders(<Probe />, { store: first });
    expect(screen.getByText(/lines:1$/)).toBeOnTheScreen();
  });

  it('keeps the store locked until the storage answers, then rehydrates it', async () => {
    const storage = createMemoryStorage({ holdReads: true });
    const store = createTestStore({ storage });
    const { rehydrated } = startPersistence(store);
    expect(store.getState()._persist.rehydrated).toBe(false);

    storage.releaseReads();
    await rehydrated;
    expect(store.getState()._persist.rehydrated).toBe(true);
  });

  it('restores a stored cart line, and starts empty when the stored slice is corrupt', async () => {
    const persisted = (cart: unknown) =>
      createMemoryStorage({
        initial: {
          'persist:root': JSON.stringify({
            cart: JSON.stringify(cart),
            _persist: JSON.stringify({ version: 3, rehydrated: true }),
          }),
        },
      });
    const line = { productId: 'product-261009-001', name: 'Complete Daily Powder', unitPrice: 1299, currency: 'MXN', stock: 5, quantity: 2 };

    const restored = createTestStore({ storage: persisted({ lines: [line] }) });
    await startPersistence(restored).rehydrated;
    expect(restored.getState().cart.lines).toEqual([line]);

    const corrupt = createTestStore({ storage: persisted({ lines: 'broken' }) });
    await startPersistence(corrupt).rehydrated;
    expect(corrupt.getState().cart.lines).toEqual([]);
  });
});
