import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { initialAttempt, transitionAttempt, type AttemptOutcome, type AttemptState } from '../logic/attempt-machine.ts';

const slice = createSlice({ name: 'checkoutAttempt', initialState: initialAttempt, reducers: {
  attemptSubmitted: (state, action: PayloadAction<{ key: string; fingerprint: string }>) => transitionAttempt(state, { type: 'submitted', ...action.payload }),
  attemptOutcome: (state, action: PayloadAction<{ source: 'post' | 'status'; outcome: AttemptOutcome }>) => transitionAttempt(state, { type: action.payload.source === 'post' ? 'postOutcome' : 'statusOutcome', outcome: action.payload.outcome }),
  attemptRestored: (state) => transitionAttempt(state, { type: 'restored' }),
  waitCancelled: (state) => transitionAttempt(state, { type: 'waitCancelled' }),
}});
export const { attemptSubmitted, attemptOutcome, attemptRestored, waitCancelled } = slice.actions;
export const checkoutAttemptReducer = slice.reducer;
export type CheckoutAttemptState = AttemptState;
