import type { ProductDetail } from '../../product/contracts/catalog-product.ts';
import { addLine, type CartLines, type CartProduct } from './cart.ts';

export const ADD_PRESS_LOCKOUT_MS = 700;

export type AddOutcome =
  | Readonly<{
      status: 'added';
      addedUnits: number;
      quantityInCart: number;
      limited: boolean;
    }>
  | Readonly<{ status: 'at-limit'; quantityInCart: number }>
  | Readonly<{ status: 'locked' | 'sold-out' | 'ignored' }>;

export type AddPlan = Readonly<{
  outcome: AddOutcome;
  shouldDispatch: boolean;
}>;

/** Keeps a double tap as one interaction while allowing a later, deliberate second add. */
export function acceptAddPress(previousAcceptedAt: number | undefined, now: number): boolean {
  return (
    previousAcceptedAt === undefined ||
    now < previousAcceptedAt ||
    now - previousAcceptedAt >= ADD_PRESS_LOCKOUT_MS
  );
}

/** Takes only the minimal, offline-capable cart snapshot approved in plan 004. */
export function toCartProduct(
  product: Pick<ProductDetail, 'id' | 'name' | 'images' | 'price' | 'currency' | 'stock'>,
): CartProduct {
  return {
    productId: product.id,
    name: product.name,
    ...(product.images[0] === undefined ? {} : { imagePath: product.images[0] }),
    unitPrice: product.price,
    currency: product.currency,
    stock: product.stock,
  };
}

export function quantityInCart(lines: CartLines, productId: string): number {
  return lines.find((line) => line.productId === productId)?.quantity ?? 0;
}

/**
 * Decides an add against one snapshot of the current Redux state. The thunk uses this decision to
 * emit at most one `cart/productAdded`; badge and subtotal then derive from that same reducer pass.
 */
export function planAdd({
  lines,
  locked,
  product,
  quantity,
}: Readonly<{
  lines: CartLines;
  locked: boolean;
  product: CartProduct;
  quantity: number;
}>): AddPlan {
  if (locked) {
    return { outcome: { status: 'locked' }, shouldDispatch: false };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { outcome: { status: 'ignored' }, shouldDispatch: false };
  }
  if (product.stock < 1) {
    return { outcome: { status: 'sold-out' }, shouldDispatch: false };
  }

  const before = quantityInCart(lines, product.productId);
  const result = addLine(lines, product, quantity);
  const after = quantityInCart(result.lines, product.productId);
  const addedUnits = Math.max(0, after - before);
  const shouldDispatch = result.lines !== lines;

  if (addedUnits === 0) {
    return { outcome: { status: 'at-limit', quantityInCart: after }, shouldDispatch };
  }

  return {
    outcome: {
      status: 'added',
      addedUnits,
      quantityInCart: after,
      limited: after >= product.stock,
    },
    shouldDispatch,
  };
}
