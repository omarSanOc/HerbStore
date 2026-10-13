import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { OrderSummary } from '../../checkout/contracts/order.ts';
import { addOrderSummary, emptyOrderHistory } from '../logic/order-history.ts';
const slice = createSlice({ name: 'orderHistory', initialState: emptyOrderHistory, reducers: {
  orderRecorded: (state, action: PayloadAction<OrderSummary>) => addOrderSummary(state, action.payload).state,
}});
export const { orderRecorded } = slice.actions;
export const orderHistoryReducer = slice.reducer;
