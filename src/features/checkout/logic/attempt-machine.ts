export type AttemptStatus = 'idle' | 'preliminary' | 'unresolved';
export type AttemptState = Readonly<{ status: 'idle' } | { status: Exclude<AttemptStatus, 'idle'>; key: string; fingerprint: string; remoteStatus?: 'pending' }>;
export const initialAttempt: AttemptState = { status: 'idle' };
export type AttemptOutcome = 'confirmed' | 'pending' | 'validation' | 'outOfStock' | 'keyReused' | 'notCreated' | 'expired' | 'uncertain' | 'inconsistent';
export type AttemptEvent =
  | ({ type: 'submitted'; key: string; fingerprint: string })
  | ({ type: 'postOutcome' | 'statusOutcome'; outcome: AttemptOutcome })
  | { type: 'restored' }
  | { type: 'waitCancelled' };

export function transitionAttempt(state: AttemptState, event: AttemptEvent): AttemptState {
  if (event.type === 'submitted') return state.status === 'idle' ? { status: 'preliminary', key: event.key, fingerprint: event.fingerprint } : state;
  if (state.status === 'idle') return state;
  if (event.type === 'restored') return state.status === 'preliminary' ? { ...state, status: 'unresolved' } : state;
  if (event.type === 'waitCancelled') return state;
  const outcome = event.outcome;
  if (event.type === 'postOutcome' && state.status === 'preliminary' && (outcome === 'validation' || outcome === 'outOfStock')) return initialAttempt;
  if (outcome === 'confirmed' || outcome === 'notCreated' || outcome === 'expired') return initialAttempt;
  return { ...state, status: 'unresolved', ...(outcome === 'pending' ? { remoteStatus: 'pending' as const } : {}) };
}
