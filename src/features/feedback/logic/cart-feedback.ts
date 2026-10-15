import type { CartLines } from '../../cart/logic/cart.ts';

export type CartFeedbackAction = 'productAdded' | 'lineIncremented' | 'lineDecremented' | 'lineRemoved';

export type CartFeedbackSnapshot = Readonly<{ lines: CartLines }>;

const ACCEPTED_ACTIONS: Readonly<Record<string, CartFeedbackAction>> = {
  'cart/productAdded': 'productAdded',
  'cart/lineIncremented': 'lineIncremented',
  'cart/lineDecremented': 'lineDecremented',
  'cart/lineRemoved': 'lineRemoved',
};

function sameLines(before: CartLines, after: CartLines): boolean {
  if (before.length !== after.length) return false;
  return before.every((line, index) => {
    const next = after[index];
    return next !== undefined && JSON.stringify(line) === JSON.stringify(next);
  });
}

export function cartFeedbackAction(
  actionType: string,
  before: CartFeedbackSnapshot,
  after: CartFeedbackSnapshot,
): CartFeedbackAction | undefined {
  const action = ACCEPTED_ACTIONS[actionType];
  return action !== undefined && !sameLines(before.lines, after.lines) ? action : undefined;
}
