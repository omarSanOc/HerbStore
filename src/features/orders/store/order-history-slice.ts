import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OrderSummary } from '../../checkout/contracts/order.ts';
import { addOrderSummary, emptyOrderHistory } from '../logic/order-history.ts';
import {
  markNotificationFailed,
  markNotificationScheduled,
  markNotificationScheduling,
  markNotificationUnusable,
  markPermissionRequested,
  type UnusableReason,
} from '../logic/order-notification-state.ts';
const slice = createSlice({ name: 'orderHistory', initialState: emptyOrderHistory, reducers: {
  orderRecorded: (state, action: PayloadAction<OrderSummary>) => addOrderSummary(state, action.payload).state,
  notificationPermissionRequested: (state, action: PayloadAction<string>) => { state.notifications = markPermissionRequested(state.notifications, action.payload); },
  notificationScheduling: (state, action: PayloadAction<string>) => { state.notifications = markNotificationScheduling(state.notifications, action.payload); },
  notificationScheduled: (state, action: PayloadAction<string>) => { state.notifications = markNotificationScheduled(state.notifications, action.payload); },
  // RF-39: the reason of the last evaluation replaces any previous one for this order.
  notificationUnusable: (state, action: PayloadAction<{ orderId: string; canOpenSettings: boolean; reason: UnusableReason }>) => { state.notifications = markNotificationUnusable(state.notifications, action.payload.orderId, action.payload.canOpenSettings, action.payload.reason); },
  notificationFailed: (state, action: PayloadAction<string>) => { state.notifications = markNotificationFailed(state.notifications, action.payload); },
  notificationRetryRequested: (state, _action: PayloadAction<string>) => state,
}});
export const {
  orderRecorded,
  notificationFailed,
  notificationPermissionRequested,
  notificationRetryRequested,
  notificationScheduled,
  notificationScheduling,
  notificationUnusable,
} = slice.actions;
export const orderHistoryReducer = slice.reducer;
