/// <reference types="jest" />
// RF-14 (T6a, Days 4-5 follow-ups). What the product detail SAYS to a screen reader after an action
// that changes nothing it would notice by itself:
//   - quantity: pressing "+" / "-" does not move the reader's focus, so the new quantity and the
//     total are announced; the reader's own increment/decrement gestures read the value themselves,
//     so only the stock LIMIT is announced for them (RF-6, Day 4 T3);
//   - the stock limit: always written under the selector, and announced when an attempt hits it;
//   - sharing: a failure shows a message with a retry and is announced once; a cancel is silent
//     (RF-26, Day 5 T7).
// These tests pin WHAT is announced and WHEN. Whether the platform voice finishes the sentence is
// listening evidence (`docs/evidence/day-6-accessibility.md`), not something Jest can observe.
//
// Compose: `semantics { stateDescription }` + `liveRegion`; SwiftUI: `.accessibilityValue` and
// `AccessibilityNotification.Announcement`.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Share } from 'react-native';

import { setAppForeground } from '@/test/app-state';
import { createTestStore, startPersistence, wireProduct } from '@/test/fixtures';
import { createMockFetch, reply } from '@/test/mock-fetch';
import { resetRouterMock } from '@/test/mock-expo-router';
import { resetReconnectionMock } from '@/test/mock-reconnection';
import { renderWithProviders } from '@/test/render-with-providers';

import { ProductDetailScreen } from './ProductDetailScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);

type Language = 'es' | 'en';

const ID = 'product-261009-001';
const ROUTE = `GET /products/${ID}`;

const TEXT = {
  es: {
    increase: 'Aumentar cantidad',
    decrease: 'Disminuir cantidad',
    changed: (quantity: number) => `Cantidad ${quantity}. Total `,
    limit: 'Máximo disponible: 3 unidades.',
    share: 'Compartir',
    shareFailed: 'No se pudo compartir el producto. Inténtalo de nuevo.',
    shareRetry: 'Reintentar compartir',
  },
  en: {
    increase: 'Increase quantity',
    decrease: 'Decrease quantity',
    changed: (quantity: number) => `Quantity ${quantity}. Total `,
    limit: 'Maximum available: 3 units.',
    share: 'Share',
    shareFailed: 'The product could not be shared. Try again.',
    shareRetry: 'Try sharing again',
  },
} as const;

describe('ProductDetailScreen announcements', () => {
  let mock: ReturnType<typeof createMockFetch>;
  let announce: jest.SpyInstance;

  beforeEach(async () => {
    jest.useFakeTimers();
    resetRouterMock();
    resetReconnectionMock();
    setAppForeground();
    mock = createMockFetch();
    mock.install();
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    announce.mockClear();
  });

  afterEach(() => {
    expect(mock.unmatched).toEqual([]);
    mock.uninstall();
  });

  async function mount(language: Language) {
    mock.enqueue(ROUTE, reply.localized(wireProduct(1, { stock: 3, inStock: true }), language));
    const store = createTestStore();
    await startPersistence(store).rehydrated;
    await renderWithProviders(<ProductDetailScreen rawId={ID} />, { language, store });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10);
    });
    announce.mockClear();
  }

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('QUANTITY by the buttons: each change announces the new quantity and the total, once', async () => {
      await mount(language);

      await fireEvent.press(screen.getByRole('button', { name: text.increase }));
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenLastCalledWith(expect.stringContaining(text.changed(2)));

      await fireEvent.press(screen.getByRole('button', { name: text.increase }));
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith(expect.stringContaining(text.changed(3)));

      await fireEvent.press(screen.getByRole('button', { name: text.decrease }));
      expect(announce).toHaveBeenCalledTimes(3);
      expect(announce).toHaveBeenLastCalledWith(expect.stringContaining(text.changed(2)));
    });

    it('LIMIT: the line is always there; hitting it announces it (not the quantity again)', async () => {
      await mount(language);
      // Written before it is hit: it never depends on a sound.
      expect(screen.getByText(text.limit)).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: text.increase }));
      await fireEvent.press(screen.getByRole('button', { name: text.increase }));
      announce.mockClear();

      // Stock is 3 and the quantity is 3: one more press keeps 3 and says why.
      await fireEvent.press(screen.getByRole('button', { name: text.increase }));
      await fireEvent.press(screen.getByRole('button', { name: text.increase }));

      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenNthCalledWith(1, text.limit);
      expect(announce).toHaveBeenNthCalledWith(2, text.limit);
      // The quantity did not move past the stock.
      expect(screen.getByRole('adjustable')).toHaveProp('accessibilityValue', {
        text: expect.stringContaining('3'),
      });
    });

    it("the reader's own increment gesture reads the value itself (no announcement), but the limit IS announced", async () => {
      await mount(language);
      const quantity = () => screen.getByRole('adjustable');
      const increment = () =>
        fireEvent(quantity(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

      await increment();
      await increment();
      expect(announce).not.toHaveBeenCalled();

      await increment();
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(text.limit);
    });

      describe('sharing', () => {
      it('passes share content and options as the native API expects', async () => {
        const share = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' });
        await mount(language);

        await fireEvent.press(screen.getByRole('button', { name: text.share }));
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });

        expect(share).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Complete Daily Powder 001',
            message: expect.stringContaining('herbstore://product/product-261009-001'),
          }),
          expect.objectContaining({
            dialogTitle: expect.any(String),
            subject: 'Complete Daily Powder 001',
          }),
        );
      });

      it('FAILURE: the message and its retry appear and the failure is announced ONCE', async () => {
        const share = jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('no sheet'));
        await mount(language);

        await fireEvent.press(screen.getByRole('button', { name: text.share }));
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });

        expect(share).toHaveBeenCalledTimes(1);
        expect(screen.getByText(text.shareFailed)).toBeOnTheScreen();
        expect(screen.getByRole('button', { name: text.shareRetry })).toBeOnTheScreen();
        expect(announce).toHaveBeenCalledTimes(1);
        expect(announce).toHaveBeenCalledWith(text.shareFailed);
      });

      it('RETRY that works clears the message and says nothing', async () => {
        jest
          .spyOn(Share, 'share')
          .mockRejectedValueOnce(new Error('no sheet'))
          .mockResolvedValueOnce({ action: 'sharedAction' });
        await mount(language);
        await fireEvent.press(screen.getByRole('button', { name: text.share }));
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });
        announce.mockClear();

        await fireEvent.press(screen.getByRole('button', { name: text.shareRetry }));
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });

        expect(screen.queryByText(text.shareFailed)).not.toBeOnTheScreen();
        expect(announce).not.toHaveBeenCalled();
      });

      it('CANCEL (iOS dismissedAction) is not a failure: no message, no announcement', async () => {
        jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'dismissedAction' });
        await mount(language);

        await fireEvent.press(screen.getByRole('button', { name: text.share }));
        await act(async () => {
          await jest.advanceTimersByTimeAsync(0);
        });

        expect(screen.queryByText(text.shareFailed)).not.toBeOnTheScreen();
        expect(announce).not.toHaveBeenCalled();
      });
    });
  });
});
