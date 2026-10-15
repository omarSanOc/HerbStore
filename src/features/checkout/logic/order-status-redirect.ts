import type { AttemptOutcome, AttemptStatus } from './attempt-machine.ts';

/**
 * One-shot redirect guard for the order status screen (RF-38).
 *
 * - `watching`: the screen is visible and reacts to the attempt status.
 * - `consulting`: a status consult is in flight; the attempt may turn `idle` because the consult
 *   itself confirmed the order, so `idle` must wait for the consult result instead of redirecting.
 * - `done`: a redirect was decided or the user left; nothing decides again.
 *
 * Pure and framework-free so the rule is tested in Node; the screen keeps the phase in a ref and
 * only navigates from an effect or from the consult continuation, never while rendering.
 */
export type RedirectPhase = 'watching' | 'consulting' | 'done';
export type RedirectTarget = 'checkout' | 'order-confirmation';
export type RedirectEvent =
  | Readonly<{ type: 'attemptObserved'; status: AttemptStatus }>
  | Readonly<{ type: 'consultStarted' }>
  /** `outcome` is `undefined` when the consult threw: the decision falls back to the current status. */
  | Readonly<{ type: 'consultFinished'; outcome: AttemptOutcome | undefined; status: AttemptStatus }>
  | Readonly<{ type: 'left' }>;
export type RedirectDecision = Readonly<{ phase: RedirectPhase; redirect: RedirectTarget | null }>;

export const initialRedirectPhase: RedirectPhase = 'watching';

const stay = (phase: RedirectPhase): RedirectDecision => ({ phase, redirect: null });
const go = (redirect: RedirectTarget): RedirectDecision => ({ phase: 'done', redirect });

export function nextRedirect(phase: RedirectPhase, event: RedirectEvent): RedirectDecision {
  if (phase === 'done') return stay('done');
  switch (event.type) {
    case 'left':
      return stay('done');
    case 'consultStarted':
      return stay('consulting');
    case 'attemptObserved':
      return phase === 'watching' && event.status === 'idle' ? go('checkout') : stay(phase);
    case 'consultFinished':
      if (phase !== 'consulting') return stay(phase);
      if (event.outcome === 'confirmed') return go('order-confirmation');
      return event.status === 'idle' ? go('checkout') : stay('watching');
  }
}
