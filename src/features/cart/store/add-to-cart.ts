import type { AppDispatch, RootState } from '@/core/store/store';

import { planAdd, type AddOutcome } from '../logic/add-to-cart.ts';
import type { CartProduct } from '../logic/cart.ts';
import { selectCartLines, selectIsCartLocked } from '../logic/cart-selectors.ts';
import { productAdded } from './cart-slice.ts';

type AddProductArgs = Readonly<{ product: CartProduct; quantity: number }>;

/** Reads lock + lines once, then emits zero or one domain event. */
export function addProductToCart({ product, quantity }: AddProductArgs) {
  return (dispatch: AppDispatch, getState: () => RootState): AddOutcome => {
    const state = getState();
    const plan = planAdd({
      lines: selectCartLines(state),
      locked: selectIsCartLocked(state),
      product,
      quantity,
    });

    if (plan.shouldDispatch) {
      dispatch(productAdded({ product, quantity }));
    }

    return plan.outcome;
  };
}
