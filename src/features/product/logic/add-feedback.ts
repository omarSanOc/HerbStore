import type { AddOutcome } from '../../cart/logic/add-to-cart.ts';

export const FEEDBACK_HOLD_MS = 2200;

export type AddFeedbackPart =
  | Readonly<{ key: 'added' | 'maxInCart'; count: number }>
  | Readonly<{ key: 'locked' | 'soldOut' }>;

export type AddFeedbackModel = Readonly<{
  tone: 'success' | 'limit' | 'blocked';
  parts: readonly AddFeedbackPart[];
}>;

export type AddFeedbackState = Readonly<{
  id: number;
  model?: AddFeedbackModel;
}>;

export const INITIAL_ADD_FEEDBACK: AddFeedbackState = { id: 0 };

export function describeAddOutcome(outcome: AddOutcome): AddFeedbackModel | undefined {
  switch (outcome.status) {
    case 'added':
      return {
        tone: outcome.limited ? 'limit' : 'success',
        parts: [
          { key: 'added', count: outcome.addedUnits },
          ...(outcome.limited
            ? ([{ key: 'maxInCart', count: outcome.quantityInCart }] as const)
            : []),
        ],
      };
    case 'at-limit':
      return { tone: 'limit', parts: [{ key: 'maxInCart', count: outcome.quantityInCart }] };
    case 'locked':
      return { tone: 'blocked', parts: [{ key: 'locked' }] };
    case 'sold-out':
      return { tone: 'blocked', parts: [{ key: 'soldOut' }] };
    case 'ignored':
      return undefined;
  }
}

export function nextAddFeedback(
  state: AddFeedbackState,
  model: AddFeedbackModel,
): AddFeedbackState {
  return { id: state.id + 1, model };
}

export function resolveFeedbackMotion(reducedMotion: boolean) {
  return {
    animated: !reducedMotion,
    startOffsetY: reducedMotion ? 0 : 12,
    startScale: reducedMotion ? 1 : 0.96,
    fadeInMs: reducedMotion ? 0 : 180,
    holdMs: FEEDBACK_HOLD_MS,
    fadeOutMs: reducedMotion ? 0 : 180,
  } as const;
}
