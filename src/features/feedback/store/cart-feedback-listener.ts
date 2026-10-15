import { createListenerMiddleware, type UnknownAction } from '@reduxjs/toolkit';

import { cartFeedbackAction, type CartFeedbackSnapshot } from '../logic/cart-feedback.ts';
import { runOptionalFeedback } from '../logic/optional-feedback.ts';

type StateWithCart = Readonly<{ cart: CartFeedbackSnapshot }>;

/**
 * A listener that runs AFTER the reducer has accepted a `cart/*` action and requests one impact
 * only when the lines really changed (`cartFeedbackAction` compares `getOriginalState()` with the
 * state now). That is why a stock limit, a locked cart, a sold out product or the 700 ms double-tap
 * lockout never "vibrate": they dispatch nothing, or the reducer hands back the same lines.
 *
 * The native call is injected so the rule is tested in Node with the real slices; the app wires the
 * haptics in `native-feedback-listeners.ts`. Whatever the injected function does (reject, throw,
 * never settle) is absorbed here by `runOptionalFeedback`: the cart is final before the effect starts.
 *
 * Compose: a collector of the cart `StateFlow` in an app-scoped `CoroutineScope` that calls
 * `LocalHapticFeedback`/`Vibrator` after `distinctUntilChanged`; SwiftUI: `.sensoryFeedback(.impact,
 * trigger: cart.lines)`, which also fires only when the observed value changes.
 */
export function createCartFeedbackListener(requestImpact: () => Promise<unknown> | unknown) {
  const listener = createListenerMiddleware();

  listener.startListening({
    predicate: (action: UnknownAction): boolean => action.type.startsWith('cart/'),
    effect: async (action, listenerApi) => {
      const before = listenerApi.getOriginalState() as StateWithCart;
      const after = listenerApi.getState() as StateWithCart;
      if (cartFeedbackAction(action.type, before.cart, after.cart) !== undefined) {
        await runOptionalFeedback(requestImpact);
      }
    },
  });

  return listener;
}
