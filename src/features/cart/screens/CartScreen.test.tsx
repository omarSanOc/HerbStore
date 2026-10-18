/// <reference types="jest" />
// RF-4 (T3a). The cart as the user lives it, in every state it can be in:
//   RESTORING  (blocked until redux-persist answers; day 5 T7 only proved this in logic),
//   UNRESOLVED (an order whose answer was lost blocks the cart),
//   EMPTY, and WITH LINES (quantity, stock limit, remove, subtotal, checkout).
// Found by role / accessible name / visible text, in Spanish and English.
//
// Compose: `onNodeWithText("Restoring cart…").assertIsDisplayed()` over a `sealed interface
// CartUiState` (Restoring, Unresolved, Empty, Content). SwiftUI: a `switch` over an enum with
// associated values whose preview renders each case.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { selectCartUnits } from '@/features/cart/logic/cart-selectors';
import { productAdded } from '@/features/cart/store/cart-slice';
import { NAVIGATION_LOCKOUT_MS } from '@/features/navigation/logic/navigation-lockout';
import { formatMoney } from '@/features/preferences/logic/currency';
import { currencyChanged } from '@/features/preferences/store/preferences-slice';
import { attemptOutcome, attemptSubmitted } from '@/features/checkout/store/checkout-attempt-slice';
import { createMemoryStorage, createTestStore, startPersistence } from '@/test/fixtures';
import { resetRouterMock, router, tabsNavigation } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';

import { CartScreen } from './CartScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

type Language = 'es' | 'en';

const TEXT = {
  es: {
    restoring: 'Restaurando carrito…',
    unresolved: 'Pedido sin resolver',
    reopen: 'Reabrir consulta',
    emptyTitle: 'Tu carrito está vacío',
    goHome: 'Ir a Inicio',
    checkout: 'Continuar al checkout',
    checkoutHint: 'Abre el formulario de dirección para hacer el pedido.',
    checkoutEmptyHint: 'Agrega al menos un producto para continuar.',
    subtotal: 'Subtotal',
    delete: 'Eliminar Complete Daily Powder 001',
    increase: 'Aumentar cantidad de Complete Daily Powder 001',
    decrease: 'Disminuir cantidad de Complete Daily Powder 001',
    decreasePrefix: 'Disminuir cantidad de ',
    quantity: 'Cantidad de Complete Daily Powder 001',
    lines: (n: number) => `${n} ${n === 1 ? 'producto' : 'productos'} en tu carrito`,
    deleteNamed: (n: number) => `Eliminar Complete Daily Powder 00${n}`,
    revealedAction: 'Eliminar',
    subtotalSpoken: (amount: string) => `Subtotal del carrito: ${amount}`,
    shippingRemaining: (amount: string) => `Agrega ${amount} para obtener envío gratis.`,
    shippingQualified: 'Tu compra ya tiene envío gratis.',
    progressLabel: 'Progreso para envío gratis',
  },
  en: {
    restoring: 'Restoring cart…',
    unresolved: 'Unresolved order',
    reopen: 'Reopen status check',
    emptyTitle: 'Your cart is empty',
    goHome: 'Go to Home',
    checkout: 'Continue to checkout',
    checkoutHint: 'Opens the address form to place your order.',
    checkoutEmptyHint: 'Add at least one product to continue.',
    subtotal: 'Subtotal',
    delete: 'Delete Complete Daily Powder 001',
    increase: 'Increase quantity of Complete Daily Powder 001',
    decrease: 'Decrease quantity of Complete Daily Powder 001',
    decreasePrefix: 'Decrease quantity of ',
    quantity: 'Quantity of Complete Daily Powder 001',
    lines: (n: number) => `${n} ${n === 1 ? 'product' : 'products'} in your cart`,
    deleteNamed: (n: number) => `Delete Complete Daily Powder 00${n}`,
    revealedAction: 'Delete',
    subtotalSpoken: (amount: string) => `Cart subtotal: ${amount}`,
    shippingRemaining: (amount: string) => `Add ${amount} to get free shipping.`,
    shippingQualified: 'Your order now has free shipping.',
    progressLabel: 'Progress toward free shipping',
  },
} as const;

const PRODUCT = {
  productId: 'product-261009-001',
  name: 'Complete Daily Powder 001',
  unitPrice: 100,
  currency: 'MXN' as const,
  stock: 3,
};

/** A store whose persistence already answered (the cart is usable). */
async function unlockedStore() {
  const store = createTestStore();
  await startPersistence(store).rehydrated;
  return store;
}

const withLine = (store: Awaited<ReturnType<typeof unlockedStore>>, quantity = 2) =>
  act(async () => {
    store.dispatch(productAdded({ product: PRODUCT, quantity }));
  });

describe('CartScreen', () => {
  beforeEach(() => {
    resetRouterMock();
  });

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('RESTORING: while the storage has not answered it says so and offers NO cart action', async () => {
      const storage = createMemoryStorage({ holdReads: true });
      const store = createTestStore({ storage });
      const { rehydrated } = startPersistence(store);

      await renderWithProviders(<CartScreen />, { store, language });

      expect(screen.getByRole('header', { name: text.restoring })).toBeOnTheScreen();
      expect(screen.queryByRole('button')).not.toBeOnTheScreen();
      expect(screen.queryAllByRole('button', { includeHiddenElements: true })).toHaveLength(0);
      expect(screen.queryByText(text.emptyTitle)).not.toBeOnTheScreen();

      // The storage answers: the same screen leaves the blocked state by itself.
      await act(async () => {
        storage.releaseReads();
        await rehydrated;
      });
      expect(screen.queryByText(text.restoring)).not.toBeOnTheScreen();
      expect(screen.getByRole('header', { name: text.emptyTitle })).toBeOnTheScreen();
    });

    it('RESTORING: a stored cart appears only AFTER the restore, with its quantities', async () => {
      const persisted = {
        'persist:root': JSON.stringify({
          cart: JSON.stringify({ lines: [{ ...PRODUCT, quantity: 2 }] }),
          _persist: JSON.stringify({ version: 3, rehydrated: true }),
        }),
      };
      const storage = createMemoryStorage({ initial: persisted, holdReads: true });
      const store = createTestStore({ storage });
      const { rehydrated } = startPersistence(store);
      await renderWithProviders(<CartScreen />, { store, language });

      expect(screen.queryByText(PRODUCT.name)).not.toBeOnTheScreen();

      await act(async () => {
        storage.releaseReads();
        await rehydrated;
      });
      expect(screen.getByRole('header', { name: PRODUCT.name })).toBeOnTheScreen();
      expect(screen.getByLabelText(text.quantity)).toHaveAccessibilityValue({ now: 2 });
    });

    it('UNRESOLVED: the cart stays blocked and the only way on is to reopen the status check', async () => {
      const store = await unlockedStore();
      await withLine(store);
      await act(async () => {
        store.dispatch(attemptSubmitted({ key: 'key-0001', fingerprint: 'digest' }));
        store.dispatch(attemptOutcome({ source: 'post', outcome: 'uncertain' }));
      });
      await renderWithProviders(<CartScreen />, { store, language });

      expect(screen.getByRole('header', { name: text.unresolved })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: text.increase })).not.toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: text.delete })).not.toBeOnTheScreen();
      // RF-27: not even the revealed (reader-hidden) action of a line exists on the blocked screen.
      expect(screen.queryAllByRole('button', { name: /^(Eliminar|Delete)/, includeHiddenElements: true })).toHaveLength(0);
      expect(screen.queryByRole('button', { name: text.checkout })).not.toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: text.reopen }));
      expect(router.push).toHaveBeenCalledWith('/(tabs)/(cart)/order-status');
      // Blocked means blocked: the lines are untouched.
      expect(store.getState().cart.lines).toHaveLength(1);
    });

    it('EMPTY: says so, can go Home and shows checkout as unavailable', async () => {
      const store = await unlockedStore();
      await renderWithProviders(<CartScreen />, { store, language });

      expect(screen.getByRole('header', { name: text.emptyTitle })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.checkout })).toBeDisabled();
      // Unavailable: the hint says why.
      expect(screen.getByRole('button', { name: text.checkout })).toHaveProp('accessibilityHint', text.checkoutEmptyHint);

      await fireEvent.press(screen.getByRole('button', { name: text.goHome }));
      // Home is selected through the Tabs navigator (the plan itself is tested in `home-root-plan`).
      expect(tabsNavigation.dispatch).toHaveBeenCalledWith({
        type: 'JUMP_TO',
        payload: { name: '(home)' },
        target: 'tabs-key',
      });
    });

    it('WITH LINES: shows the line, the counter and the subtotal, and checkout is available', async () => {
      const store = await unlockedStore();
      await withLine(store, 2);
      await renderWithProviders(<CartScreen />, { store, language });

      expect(screen.getByText(text.lines(1))).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: PRODUCT.name })).toBeOnTheScreen();
      expect(screen.getByLabelText(text.quantity)).toHaveAccessibilityValue({ min: 1, max: 3, now: 2 });
      expect(screen.getByRole('button', { name: text.checkout })).toBeEnabled();
      // T6a: an enabled button must not keep saying "add a product to continue" (it was the hint of
      // the empty cart); the hint says what the button does.
      expect(screen.getByRole('button', { name: text.checkout })).toHaveProp('accessibilityHint', text.checkoutHint);

      await fireEvent.press(screen.getByRole('button', { name: text.checkout }));
      expect(router.push).toHaveBeenCalledWith('/(tabs)/(cart)/checkout');
    });
  });

  describe('quantity and removal', () => {
    it('"+" and "−" change the quantity and the subtotal; the line total follows', async () => {
      const store = await unlockedStore();
      await withLine(store, 1);
      await renderWithProviders(<CartScreen />, { store });
      const spokenSubtotal = () => screen.getByLabelText(/^Subtotal del carrito: /).props.accessibilityLabel as string;
      const before = spokenSubtotal();

      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.increase }));

      expect(screen.getByLabelText(TEXT.es.quantity)).toHaveAccessibilityValue({ now: 2 });
      expect(spokenSubtotal()).not.toBe(before);

      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.decrease }));
      expect(screen.getByLabelText(TEXT.es.quantity)).toHaveAccessibilityValue({ now: 1 });
      expect(spokenSubtotal()).toBe(before);
    });

    it('STOCK LIMIT: at the maximum "+" is disabled and nothing is dispatched', async () => {
      const store = await unlockedStore();
      await withLine(store, 3);
      await renderWithProviders(<CartScreen />, { store });

      expect(screen.getByRole('button', { name: TEXT.es.increase })).toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.increase }));
      expect(store.getState().cart.lines[0]?.quantity).toBe(3);
    });

    it('the accessibility actions of the quantity (TalkBack/VoiceOver swipe) increment and decrement', async () => {
      const store = await unlockedStore();
      await withLine(store, 1);
      await renderWithProviders(<CartScreen />, { store });
      const quantity = screen.getByLabelText(TEXT.es.quantity);

      await fireEvent(quantity, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
      expect(screen.getByLabelText(TEXT.es.quantity)).toHaveAccessibilityValue({ now: 2 });

      await fireEvent(quantity, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      expect(screen.getByLabelText(TEXT.es.quantity)).toHaveAccessibilityValue({ now: 1 });
    });

    it('"Eliminar" removes the line and the screen becomes the empty state', async () => {
      const store = await unlockedStore();
      await withLine(store, 1);
      await renderWithProviders(<CartScreen />, { store });

      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.delete }));

      await waitFor(() => expect(screen.getByRole('header', { name: TEXT.es.emptyTitle })).toBeOnTheScreen());
      expect(store.getState().cart.lines).toEqual([]);
    });

    it('"−" on the last unit removes the line (the hint says so)', async () => {
      const store = await unlockedStore();
      await withLine(store, 1);
      await renderWithProviders(<CartScreen />, { store });

      await fireEvent.press(screen.getByRole('button', { name: TEXT.es.decrease }));

      expect(store.getState().cart.lines).toEqual([]);
    });
  });
  // ---------------------------------------------------------------------------------------------
  // RF-25, RF-27, RF-28, RF-30 (T6e). Deleting ONE line of a cart with several, by the visible
  // button (RF-28) and by the revealed swipe action, which Jest sees because the library keeps it
  // mounted. No drag: the gesture is covered by Maestro and by hand (`docs/evidence/day-6-cart-swipe.md`).
  //
  // Compose: `onNodeWithContentDescription("Delete <name>").performClick()` followed by
  // `assertCountEquals` on the remaining rows. SwiftUI: tap the row's button and check the `ForEach`.
  // ---------------------------------------------------------------------------------------------
  describe.each<Language>(['es', 'en'])('deleting a line, in %s', (language) => {
    const text = TEXT[language];
    /** Fictional catalog snapshots: id, unit price in MXN, quantity and stock for the stepper. */
    const threeLines = [
      { n: 1, unitPrice: 400, quantity: 1 }, // 400.00
      { n: 2, unitPrice: 150, quantity: 2 }, // 300.00 (the middle one)
      { n: 3, unitPrice: 399.99, quantity: 1 }, // 399.99
    ] as const;

    const lineProduct = (n: number, unitPrice: number) => ({
      productId: `product-261009-00${n}`,
      name: `Complete Daily Powder 00${n}`,
      unitPrice,
      currency: 'MXN' as const,
      stock: 5,
    });

    async function storeWithLines(lines: readonly { n: number; unitPrice: number; quantity: number }[], currency?: 'USD') {
      const store = await unlockedStore();
      await act(async () => {
        if (currency) store.dispatch(currencyChanged(currency));
        for (const { n, unitPrice, quantity } of lines) {
          store.dispatch(productAdded({ product: lineProduct(n, unitPrice), quantity }));
        }
      });
      return store;
    }

    /** The visible "Delete <name>" buttons, top to bottom: one per line. */
    const visibleDeleteNames = () =>
      screen
        .getAllByRole('button', { name: new RegExp(`^${text.revealedAction} `) })
        .map((button) => button.props.accessibilityLabel as string);
    /** The revealed swipe actions (hidden from the reader), top to bottom: one per line. */
    const revealedActions = () =>
      screen.getAllByRole('button', { name: text.revealedAction, includeHiddenElements: true });
    const remainingLines = (store: Awaited<ReturnType<typeof unlockedStore>>) =>
      store.getState().cart.lines.map(({ productId, quantity }) => `${productId} x${quantity}`);

    it('RF-28: every line offers ONE delete action to the reader, named after its product', async () => {
      const store = await storeWithLines(threeLines);
      await renderWithProviders(<CartScreen />, { store, language });

      expect(visibleDeleteNames()).toEqual([text.deleteNamed(1), text.deleteNamed(2), text.deleteNamed(3)]);
      // The revealed actions exist (3) but none of them is in the accessibility tree.
      expect(revealedActions()).toHaveLength(3);
      expect(screen.queryAllByRole('button', { name: text.revealedAction })).toHaveLength(0);
      // The visible button keeps the 48 dp / 44 pt target.
      const button = screen.getByRole('button', { name: text.deleteNamed(2) });
      expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(48);
    });

    it.each([
      { position: 'first', index: 0, left: [2, 3] },
      { position: 'middle', index: 1, left: [1, 3] },
      { position: 'last', index: 2, left: [1, 2] },
    ])('RF-25: the visible button of the $position line removes only it and keeps quantities and order', async ({ index, left }) => {
      const store = await storeWithLines(threeLines);
      await renderWithProviders(<CartScreen />, { store, language });
      const before = remainingLines(store);

      await fireEvent.press(screen.getByRole('button', { name: text.deleteNamed(index + 1) }));

      expect(remainingLines(store)).toEqual(left.map((n) => before[n - 1]));
      expect(visibleDeleteNames()).toEqual(left.map(text.deleteNamed));
      expect(screen.getByText(text.lines(2))).toBeOnTheScreen();
      expect(selectCartUnits(store.getState())).toBe(left.reduce((sum, n) => sum + (threeLines[n - 1]?.quantity ?? 0), 0));
    });

    it('RF-25: the revealed action of the middle line removes only that line, same as the button', async () => {
      const store = await storeWithLines(threeLines);
      await renderWithProviders(<CartScreen />, { store, language });
      const before = remainingLines(store);

      await fireEvent.press(revealedActions()[1]!);

      expect(remainingLines(store)).toEqual([before[0], before[2]]);
      expect(visibleDeleteNames()).toEqual([text.deleteNamed(1), text.deleteNamed(3)]);
    });

    // Found in the T6e spike (Maestro, iPhone 17 Pro, two taps 50 ms apart on the "Delete" of the first
    // line): the list re-renders, the next line moves UP under the finger and the second tap deleted
    // it too (empty cart). RF-25 and the spec edge case say: ONE line, never the one that takes its
    // place. A press on the control that now sits where the first one was is the faithful model of
    // that second tap; the guard is a short window after a removal (`NAVIGATION_LOCKOUT_MS`).
    it.each([
      { path: 'visible button', control: () => screen.getAllByRole('button', { name: new RegExp(`^${text.revealedAction} `) })[1]! },
      { path: 'revealed action', control: () => revealedActions()[1]! },
    ])('RF-25: a second tap right after a removal (the $path of the next line, now in its place) removes nothing', async ({ control }) => {
      jest.useFakeTimers();
      const store = await storeWithLines(threeLines);
      await renderWithProviders(<CartScreen />, { store, language });
      const before = remainingLines(store);

      // First tap: the middle line goes. The control at the same position now belongs to line 3.
      await fireEvent.press(control());
      expect(remainingLines(store)).toEqual([before[0], before[2]]);

      await fireEvent.press(control());
      expect(remainingLines(store)).toEqual([before[0], before[2]]);

      // A deliberate tap once the window has passed works again.
      await act(async () => {
        jest.advanceTimersByTime(NAVIGATION_LOCKOUT_MS);
      });
      await fireEvent.press(control());
      expect(remainingLines(store)).toEqual([before[0]]);
    });

    // T6f decision (user: "confirm and protect −"): "−" on a line of ONE unit removes the line, so it has
    // the same root as the double tap on "Delete": the next line moves up under the finger and the
    // second tap would remove it too. The guard is the SAME one, but only when the press removes.
    const decreaseButtons = () =>
      screen.getAllByRole('button', { name: new RegExp(`^${text.decreasePrefix}`) });
    const oneUnitLines = [
      { n: 1, unitPrice: 400, quantity: 1 },
      { n: 2, unitPrice: 150, quantity: 1 },
      { n: 3, unitPrice: 399.99, quantity: 1 },
    ] as const;

    it('RF-25 (T6f): a second tap on "−" right after it removed a one-unit line removes nothing else', async () => {
      jest.useFakeTimers();
      const store = await storeWithLines(oneUnitLines);
      await renderWithProviders(<CartScreen />, { store, language });
      const before = remainingLines(store);

      // First tap: the middle line goes (quantity 1 -> removed). Keep the exact native control
      // reference to model a second native press arriving before React commits the replacement row.
      const firstControl = decreaseButtons()[1]!;
      await fireEvent.press(firstControl);
      expect(remainingLines(store)).toEqual([before[0], before[2]]);

      await fireEvent.press(firstControl);
      expect(remainingLines(store)).toEqual([before[0], before[2]]);

      // A deliberate tap once the window has passed works again.
      await act(async () => {
        jest.advanceTimersByTime(NAVIGATION_LOCKOUT_MS);
      });
      await fireEvent.press(decreaseButtons()[1]!);
      expect(remainingLines(store)).toEqual([before[0]]);
    });

    it('RF-25 (T6f): "−" and "Delete" share the guard (a removal by either one covers the other)', async () => {
      jest.useFakeTimers();
      const store = await storeWithLines(oneUnitLines);
      await renderWithProviders(<CartScreen />, { store, language });
      const before = remainingLines(store);

      await fireEvent.press(screen.getByRole('button', { name: text.deleteNamed(2) }));
      expect(remainingLines(store)).toEqual([before[0], before[2]]);

      await fireEvent.press(decreaseButtons()[1]!);
      expect(remainingLines(store)).toEqual([before[0], before[2]]);
    });

    it('RF-25 (T6f): "−" on a line with MORE than one unit is never blocked (two fast taps lower two units)', async () => {
      const store = await storeWithLines([{ n: 1, unitPrice: 100, quantity: 3 }, { n: 2, unitPrice: 100, quantity: 1 }]);
      await renderWithProviders(<CartScreen />, { store, language });

      await fireEvent.press(decreaseButtons()[0]!);
      await fireEvent.press(decreaseButtons()[0]!);

      expect(remainingLines(store)).toEqual(['product-261009-001 x1', 'product-261009-002 x1']);
      // The line with one unit left is a removal now and the guard has not been used yet: it goes.
      await fireEvent.press(decreaseButtons()[0]!);
      expect(remainingLines(store)).toEqual(['product-261009-002 x1']);
    });

    it('RF-25: removing the LAST line leaves the empty state with checkout unavailable', async () => {
      const store = await storeWithLines([threeLines[0]]);
      await renderWithProviders(<CartScreen />, { store, language });

      await fireEvent.press(revealedActions()[0]!);

      expect(screen.getByRole('header', { name: text.emptyTitle })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: text.checkout })).toBeDisabled();
      expect(screen.getByRole('button', { name: text.goHome })).toBeOnTheScreen();
      expect(store.getState().cart.lines).toEqual([]);
    });

    // The canonical subtotal decides the free shipping, whatever currency is shown (spec 004 RF-13).
    // 799.99 MXN is $44.44 in USD, the same figure as the threshold ($44.44): the view alone cannot
    // tell, so the verdict must come from the canonical value.
    it.each([
      { currency: 'MXN' as const, subtotalCents: 79_999 },
      { currency: 'USD' as const, subtotalCents: 4_444 },
    ])('RF-25 / spec edge: deleting the middle line crosses 800 MXN downwards in $currency', async ({ currency, subtotalCents }) => {
      const store = await storeWithLines(threeLines, currency === 'USD' ? 'USD' : undefined);
      await renderWithProviders(<CartScreen />, { store, language });
      // Before: 400.00 + 300.00 + 399.99 = 1,099.99 MXN, free shipping.
      const subtotalBefore = formatMoney(currency === 'USD' ? 6_111 : 109_999, currency, language);
      expect(screen.getByLabelText(text.subtotalSpoken(subtotalBefore))).toBeOnTheScreen();
      expect(screen.getByText(text.shippingQualified)).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: text.deleteNamed(2) }));

      // After: 799.99 MXN, one cent short, in either currency.
      expect(screen.getByLabelText(text.subtotalSpoken(formatMoney(subtotalCents, currency, language)))).toBeOnTheScreen();
      expect(screen.queryByText(text.shippingQualified)).not.toBeOnTheScreen();
      expect(screen.getByText(text.shippingRemaining(formatMoney(1, currency, language)))).toBeOnTheScreen();
    });

    it.each([
      { currency: 'MXN' as const, subtotal: 60_000, remaining: 20_000 },
      { currency: 'USD' as const, subtotal: 3_333, remaining: 1_111 },
    ])('RF-25: subtotal, remainder and progress follow the deletion in $currency', async ({ currency, subtotal, remaining }) => {
      const store = await storeWithLines(
        [
          { n: 1, unitPrice: 500, quantity: 1 },
          { n: 2, unitPrice: 200, quantity: 2 },
          { n: 3, unitPrice: 100, quantity: 1 },
        ],
        currency === 'USD' ? 'USD' : undefined,
      );
      await renderWithProviders(<CartScreen />, { store, language });
      expect(screen.getByLabelText(text.progressLabel)).toHaveAccessibilityValue({ now: 100 });

      await fireEvent.press(screen.getByRole('button', { name: text.deleteNamed(2) }));

      expect(screen.getByLabelText(text.subtotalSpoken(formatMoney(subtotal, currency, language)))).toBeOnTheScreen();
      expect(screen.getByText(text.shippingRemaining(formatMoney(remaining, currency, language)))).toBeOnTheScreen();
      // 600 of 800 MXN: 75 %.
      expect(screen.getByLabelText(text.progressLabel)).toHaveAccessibilityValue({ now: 75 });
    });

    it('RF-27: if the cart gets blocked with lines on screen, no delete is left (button or revealed action)', async () => {
      const store = await storeWithLines(threeLines);
      await renderWithProviders(<CartScreen />, { store, language });
      expect(revealedActions()).toHaveLength(3);
      // The reachable path: a checkout attempt starts while the cart is on screen (the rows were
      // mounted). `CartScreen` swaps the WHOLE list for the blocked screen, so every row unmounts
      // and a row that was open goes with its revealed action.
      await act(async () => {
        store.dispatch(attemptSubmitted({ key: 'key-0001', fingerprint: 'digest' }));
      });

      expect(screen.queryAllByRole('button', { name: /^(Eliminar|Delete)/, includeHiddenElements: true })).toHaveLength(0);
      expect(screen.queryByRole('button', { name: text.increase })).not.toBeOnTheScreen();
      expect(store.getState().cart.lines).toHaveLength(3);
    });
  });
});
