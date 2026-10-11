import { useSyncExternalStore } from 'react';

import { cartCountSource, type CartCountSource } from './cart-count-source';

export function useCartCount(source: CartCountSource = cartCountSource) {
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
