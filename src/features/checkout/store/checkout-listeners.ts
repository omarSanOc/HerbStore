import { createListenerMiddleware } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import { attemptRestored } from './checkout-attempt-slice.ts';
import { ordersApi } from '../data/orders-api';

/** Application-scoped equivalent of collecting a SharedFlow in Android/iOS app scope. */
export const checkoutListenerMiddleware = createListenerMiddleware();
checkoutListenerMiddleware.startListening({
  predicate: (action): boolean => action.type === REHYDRATE,
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState() as { checkoutAttempt?: { status: string; key?: string } };
    const attempt = state.checkoutAttempt;
    if (!attempt || (attempt.status !== 'preliminary' && attempt.status !== 'unresolved') || !attempt.key) return;
    if (attempt.status === 'preliminary') listenerApi.dispatch(attemptRestored());
    listenerApi.dispatch(ordersApi.endpoints.getOrderStatus.initiate(attempt.key, { subscribe: false, forceRefetch: true }));
  },
});
