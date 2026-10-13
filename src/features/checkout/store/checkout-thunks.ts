import * as Crypto from 'expo-crypto';
import { createAsyncThunk } from '@reduxjs/toolkit';

import type { ApiError } from '@/core/api/api-error';
import { baseApi } from '@/core/api/base-api';
import type { AppDispatch, RootState } from '@/core/store/store';
import { productsApi } from '@/features/product/data/products-api';
import { applyStockRefresh } from '@/features/cart/logic/cart';
import { selectCartLines } from '@/features/cart/logic/cart-selectors';
import { cartCleared, stockRefreshed } from '@/features/cart/store/cart-slice';
import { selectPreferredCurrency } from '@/features/preferences/store/preferences-slice';
import { orderRecorded } from '@/features/orders/store/order-history-slice';

import type { OrderItem, OrderResult, ShippingAddress } from '../contracts/order';
import { createFingerprint } from '../logic/fingerprint';
import { canonicalizeOrderRequest } from '../logic/canonical-order-request';
import { parseOrderOutcome } from '../logic/order-outcome';
import { tagsForOrderResult } from '../logic/order-invalidation';
import { buildCheckoutRequest } from '../logic/checkout-request';
import { attemptOutcome, attemptSubmitted } from './checkout-attempt-slice';
import { ordersApi } from '../data/orders-api';

export { buildCheckoutRequest };

type SubmitPayload = Readonly<{ shippingAddress: ShippingAddress }>;
type ThunkState = RootState;
const createThunk = createAsyncThunk.withTypes<{ state: RootState; dispatch: AppDispatch }>();

const digest = (value: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);

function errorResult(error: unknown): { error: ApiError } {
  return { error: error as ApiError };
}

function finish(dispatch: AppDispatch, getState: () => ThunkState, result: OrderResult | undefined, error: unknown, source: 'post' | 'status', items: readonly OrderItem[]) {
  const outcome = parseOrderOutcome(result ? { data: result } : errorResult(error));
  dispatch(attemptOutcome({ source, outcome }));
  if (outcome === 'confirmed' && result?.status === 'confirmed') {
    if (result.summary) dispatch(orderRecorded(result.summary));
    dispatch(cartCleared());
    dispatch(baseApi.util.invalidateTags(tagsForOrderResult(result, items)));
  }
  return { outcome, result, state: getState() };
}

export const submitOrder = createThunk('checkout/submitOrder', async ({ shippingAddress }: SubmitPayload, { dispatch, getState }) => {
  const state = getState() as ThunkState;
  if (state.checkoutAttempt.status !== 'idle') return { outcome: 'uncertain' as const, ignored: true };
  const lines = selectCartLines(state);
  if (lines.length === 0) return { outcome: 'uncertain' as const, ignored: true };
  const currency = selectPreferredCurrency(state);
  const request = buildCheckoutRequest(lines.map(({ productId, quantity }) => ({ productId, quantity })), currency, shippingAddress);
  const canonical = canonicalizeOrderRequest(request);
  const key = Crypto.randomUUID();
  const fingerprint = await createFingerprint(canonical, digest);
  // This is the lock: dispatch is synchronous, so a second tap observes preliminary before POST.
  dispatch(attemptSubmitted({ key, fingerprint }));
  if ((getState() as ThunkState).checkoutAttempt.key !== key) return { outcome: 'uncertain' as const, ignored: true };
  try {
    const result = await dispatch(ordersApi.endpoints.createOrder.initiate({ idempotencyKey: key, request: canonical })).unwrap();
    const outcome = finish(dispatch, () => getState() as ThunkState, result, undefined, 'post', request.items);
    const stock = outcome.outcome === 'outOfStock' ? await refreshCartStock(dispatch, lines) : undefined;
    return { ...outcome, key, adjustments: stock?.adjustments ?? [] };
  } catch (error) {
    const outcome = finish(dispatch, () => getState() as ThunkState, undefined, error, 'post', request.items);
    return { ...outcome, key };
  }
});

async function refreshCartStock(dispatch: AppDispatch, lines: ReturnType<typeof selectCartLines>) {
  const updates = [] as { productId: string; stock: number }[];
  await Promise.all(lines.map(async (line) => {
    try {
      const product = await dispatch(productsApi.endpoints.getProduct.initiate(line.productId, { subscribe: false, forceRefetch: true }));
      const value = product.data;
      if (value && Number.isSafeInteger(value.stock)) updates.push({ productId: line.productId, stock: value.stock });
    } catch { /* the order error remains visible; a later refresh can retry the catalog */ }
  }));
  const refreshed = applyStockRefresh(lines, updates);
  if (updates.length) dispatch(stockRefreshed(updates));
  return refreshed;
}

export const checkOrderStatus = createThunk('checkout/checkOrderStatus', async (key: string, { dispatch, getState }) => {
  const state = getState() as ThunkState;
  if (state.checkoutAttempt.status === 'idle' || state.checkoutAttempt.key !== key) return { outcome: 'uncertain' as const, ignored: true };
  const items = selectCartLines(state).map(({ productId, quantity }) => ({ productId, quantity }));
  try {
    const result = await dispatch(ordersApi.endpoints.getOrderStatus.initiate(key, { subscribe: false, forceRefetch: true })).unwrap();
    return finish(dispatch, () => getState() as ThunkState, result, undefined, 'status', items);
  } catch (error) {
    return finish(dispatch, () => getState() as ThunkState, undefined, error, 'status', items);
  }
});
