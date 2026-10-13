import { createSlice, current, type PayloadAction } from '@reduxjs/toolkit';

import {
  addLine,
  applyStockRefresh,
  clearCart,
  decrementLine,
  EMPTY_CART,
  incrementLine,
  removeLine,
  type CartLines,
  type CartProduct,
  type StockUpdate,
} from '../logic/cart.ts';

type CartState = Readonly<{
  /** One line per product, in the order they were added (the rules live in `cart.ts`). */
  lines: CartLines;
}>;

const initialState: CartState = { lines: EMPTY_CART };

/**
 * The cart as CLIENT state in the global store (spec 004). Each reducer only delegates to a pure
 * function of `cart.ts` (quantities, stock limits and "never mutate" are tested there) and returns
 * the next state; when nothing changed it returns the very same `state`, so nothing re-renders and
 * redux-persist writes nothing.
 *
 * It is persisted: `cart` is in the explicit whitelist of `core/storage/persist-policy.ts` and
 * `restoreCartLines` validates it line by line on the way back. The reducers do NOT know about
 * the rehydration lock: whoever changes the cart asks `selectIsCartLocked` BEFORE dispatching.
 *
 * `cart/productAdded` and, from T8, `orders/orderRecorded` are the events the Day 5 listeners will
 * watch (haptics, local notification); today they trigger nothing native.
 *
 * Compose: a `MutableStateFlow<CartState>` in an app-scoped `ViewModel` (`_state.update { ... }`),
 * later DataStore. SwiftUI: an `@Observable` cart model injected with `.environment`.
 */
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    // `current(state)` hands the pure functions a plain snapshot (never an Immer draft proxy) and,
    // for an unmodified draft, the original array, so "no change" is detected by reference.
    productAdded(state, action: PayloadAction<{ product: CartProduct; quantity: number }>) {
      const before = current(state).lines;
      const { lines } = addLine(before, action.payload.product, action.payload.quantity);
      return lines === before ? state : { lines };
    },
    lineIncremented(state, action: PayloadAction<string>) {
      const before = current(state).lines;
      const lines = incrementLine(before, action.payload);
      return lines === before ? state : { lines };
    },
    lineDecremented(state, action: PayloadAction<string>) {
      const before = current(state).lines;
      const lines = decrementLine(before, action.payload);
      return lines === before ? state : { lines };
    },
    lineRemoved(state, action: PayloadAction<string>) {
      const before = current(state).lines;
      const lines = removeLine(before, action.payload);
      return lines === before ? state : { lines };
    },
    cartCleared(state) {
      const before = current(state).lines;
      const lines = clearCart(before);
      return lines === before ? state : { lines };
    },
    /**
     * Fresh stock figures from the product detail. The checkout (T9) calls `applyStockRefresh`
     * itself first when it needs the `adjustments` to tell the user which lines were affected.
     */
    stockRefreshed(state, action: PayloadAction<readonly StockUpdate[]>) {
      const before = current(state).lines;
      const { lines } = applyStockRefresh(before, action.payload);
      return lines === before ? state : { lines };
    },
  },
});

export const {
  productAdded,
  lineIncremented,
  lineDecremented,
  lineRemoved,
  cartCleared,
  stockRefreshed,
} = cartSlice.actions;
export const cartReducer = cartSlice.reducer;
