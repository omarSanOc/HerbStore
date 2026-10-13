// The cart as pure, immutable operations (spec 004, RF-6, RF-8, RF-10, RF-11). No React Native and
// no Redux: `test:logic` runs it and `cart-slice.ts` only delegates here.
//
// Every function returns a NEW array when something changed and the very SAME array when nothing
// did, so Redux/React see "no change" by reference (no re-render, no write to storage). Untouched
// lines keep their reference too. None mutates its input.
//
// A line is a MINIMAL SNAPSHOT of the product taken when it was added (plan, decision of the user):
// enough to draw the cart, the subtotal and the shipping threshold after a restart, even offline.
// It is an accepted exception to "do not copy the catalog into slices": only these fields, only in
// cart lines, and never a source for the catalog. The price keeps its currency of origin; all
// arithmetic goes through canonical MXN cents (`currency.ts`).

import { isRecord } from '../../../core/validation/json-guards.ts';
import { isCurrencyCode, toMxnCents } from '../../preferences/logic/currency.ts';
import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';

/** What the cart remembers about a product (the line without its quantity). */
export type CartProduct = Readonly<{
  productId: string;
  name: string;
  /** Server path of the first picture, as the catalog sends it. Absent if the product has none. */
  imagePath?: string;
  /** Final unit price, in `currency` (the currency of origin, never the preferred one). */
  unitPrice: number;
  currency: CurrencyCode;
  /** Units available when the snapshot was taken. Refreshed from the product detail. */
  stock: number;
}>;

/** A cart line. Invariant of a consistent cart: `1 <= quantity <= stock`, one line per product. */
export type CartLine = CartProduct & Readonly<{ quantity: number }>;

export type CartLines = readonly CartLine[];

export const EMPTY_CART: CartLines = [];

function isWhole(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum;
}

/** The snapshot rules shared by "add" and "restore": a text id and name, a price, a stock. */
function isValidProduct(product: unknown): product is CartProduct {
  if (!isRecord(product)) {
    return false;
  }
  const { productId, name, imagePath, unitPrice, currency, stock } = product;

  return (
    typeof productId === 'string' &&
    productId !== '' &&
    typeof name === 'string' &&
    name !== '' &&
    (imagePath === undefined || (typeof imagePath === 'string' && imagePath !== '')) &&
    typeof unitPrice === 'number' &&
    Number.isFinite(unitPrice) &&
    unitPrice >= 0 &&
    isCurrencyCode(currency) &&
    isWhole(stock, 0)
  );
}

/** Rebuilds a line with ONLY the snapshot fields (nothing else a stored object carried). */
function toLine(product: CartProduct, quantity: number): CartLine {
  return {
    productId: product.productId,
    quantity,
    name: product.name,
    ...(product.imagePath === undefined ? {} : { imagePath: product.imagePath }),
    unitPrice: product.unitPrice,
    currency: product.currency,
    stock: product.stock,
  };
}

/** Canonical value of one line, in whole MXN cents. */
export function lineTotalMxnCents(line: CartLine): number {
  return toMxnCents(line.unitPrice, line.currency) * line.quantity;
}

/** Units across all lines (what the tab badge shows). */
export function cartUnits(lines: CartLines): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/** Canonical subtotal in whole MXN cents. */
export function cartSubtotalMxnCents(lines: CartLines): number {
  return lines.reduce((total, line) => total + lineTotalMxnCents(line), 0);
}

export type AddLineResult = Readonly<{
  lines: CartLines;
  /** True when the requested amount went past the stock (or the product is sold out). */
  limited: boolean;
}>;

/**
 * Adds `quantity` units of a product ONCE per call (spec RF-7). A line that already exists keeps
 * its position, takes the new total and refreshes its snapshot from the product just seen
 * (price, name, picture, stock). The total is clamped to `[1, stock]`; `limited` says whether the
 * request went past the stock so the screen can announce the limit. A sold out product, or input
 * that is not valid, changes nothing.
 */
export function addLine(lines: CartLines, product: CartProduct, quantity: number): AddLineResult {
  if (!isWhole(quantity, 1) || !isValidProduct(product)) {
    return { lines, limited: false };
  }
  if (product.stock < 1) {
    return { lines, limited: true };
  }

  const index = lines.findIndex((line) => line.productId === product.productId);
  const current = index === -1 ? undefined : lines[index];
  const wanted = (current?.quantity ?? 0) + quantity;
  const next = Math.min(wanted, product.stock);
  const limited = wanted > product.stock;

  if (current === undefined) {
    return { lines: [...lines, toLine(product, next)], limited };
  }

  const updated = toLine(product, next);
  const unchanged =
    current.quantity === updated.quantity &&
    current.name === updated.name &&
    current.imagePath === updated.imagePath &&
    current.unitPrice === updated.unitPrice &&
    current.currency === updated.currency &&
    current.stock === updated.stock;
  if (unchanged) {
    return { lines, limited };
  }

  return { lines: lines.map((line, position) => (position === index ? updated : line)), limited };
}

/** +1 on one line, up to its stock. Unknown product or already at the stock: same lines. */
export function incrementLine(lines: CartLines, productId: string): CartLines {
  const target = lines.find((line) => line.productId === productId);
  if (target === undefined || target.quantity >= target.stock) {
    return lines;
  }

  return lines.map((line) => (line === target ? { ...line, quantity: line.quantity + 1 } : line));
}

/** -1 on one line; from a single unit the line is removed (never a line with quantity 0). */
export function decrementLine(lines: CartLines, productId: string): CartLines {
  const target = lines.find((line) => line.productId === productId);
  if (target === undefined) {
    return lines;
  }
  if (target.quantity <= 1) {
    return removeLine(lines, productId);
  }

  return lines.map((line) => (line === target ? { ...line, quantity: line.quantity - 1 } : line));
}

export function removeLine(lines: CartLines, productId: string): CartLines {
  return lines.some((line) => line.productId === productId)
    ? lines.filter((line) => line.productId !== productId)
    : lines;
}

/** Empties the cart; an already empty one comes back as it is. */
export function clearCart(lines: CartLines): CartLines {
  return lines.length === 0 ? lines : EMPTY_CART;
}

/** A fresh stock figure for one product, from its detail (`getProduct`). */
export type StockUpdate = Readonly<{ productId: string; stock: number }>;

/** A line whose quantity had to change (or that disappeared) because of a stock refresh. */
export type StockAdjustment = Readonly<{
  productId: string;
  /** Kept here because a removed line no longer exists to read it from. */
  name: string;
  previousQuantity: number;
  /** 0 when the line was removed. */
  quantity: number;
  stock: number;
  removed: boolean;
}>;

export type StockRefreshResult = Readonly<{
  lines: CartLines;
  /** Only the lines the user would notice: clamped or removed, in cart order. */
  adjustments: readonly StockAdjustment[];
}>;

const NO_ADJUSTMENTS: readonly StockAdjustment[] = [];

/**
 * Applies fresh stock figures (decision of the user, T2). The stock of each affected line is
 * updated; a quantity above it is clamped to `min(quantity, stock)`; a sold out product (stock 0)
 * removes its line. The cart is left consistent (`1 <= quantity <= stock`), and `adjustments`
 * lists what had to change so the checkout can tell the user (T9). A stock that grows, or shrinks
 * but still covers the quantity, only updates the figure: the quantity is the user's.
 * With two updates for one product the last one wins; an invalid figure is ignored.
 */
export function applyStockRefresh(
  lines: CartLines,
  updates: readonly StockUpdate[],
): StockRefreshResult {
  const stocks = new Map<string, number>();
  for (const { productId, stock } of updates) {
    if (isWhole(stock, 0)) {
      stocks.set(productId, stock);
    }
  }

  const adjustments: StockAdjustment[] = [];
  const next: CartLine[] = [];
  let changed = false;

  for (const line of lines) {
    const stock = stocks.get(line.productId);
    if (stock === undefined || stock === line.stock) {
      next.push(line);
      continue;
    }

    changed = true;
    if (stock === 0) {
      adjustments.push({
        productId: line.productId,
        name: line.name,
        previousQuantity: line.quantity,
        quantity: 0,
        stock,
        removed: true,
      });
      continue;
    }

    const quantity = Math.min(line.quantity, stock);
    if (quantity !== line.quantity) {
      adjustments.push({
        productId: line.productId,
        name: line.name,
        previousQuantity: line.quantity,
        quantity,
        stock,
        removed: false,
      });
    }
    next.push({ ...line, quantity, stock });
  }

  return changed
    ? { lines: next, adjustments: adjustments.length === 0 ? NO_ADJUSTMENTS : adjustments }
    : { lines, adjustments: NO_ADJUSTMENTS };
}

/** A stored line is acceptable only if the reducers could have produced it. */
function restoreLine(stored: unknown): CartLine | undefined {
  if (!isRecord(stored)) {
    return undefined;
  }
  const { quantity } = stored;
  if (!isValidProduct(stored) || !isWhole(quantity, 1) || quantity > stored.stock) {
    return undefined;
  }

  const line = toLine(stored, quantity);
  // The line total must stay an exact integer, or the subtotal would stop being exact.
  return Number.isSafeInteger(lineTotalMxnCents(line)) ? line : undefined;
}

/**
 * Reads a persisted cart back (Day 4, RF-11). Storage is outside the app's control, so the value
 * arrives as `unknown`. If the slice is unreadable (not an array) the cart is empty. Otherwise
 * each line is judged ON ITS OWN (decision of the user): an invalid one is dropped, and so is a
 * second line for a `productId` already seen (the first wins), while the valid lines are kept in
 * order. Unlike the search history, where repairing would invent an order, a cart line stands
 * alone, so losing only the corrupt one is the least surprising outcome.
 */
export function restoreCartLines(stored: unknown): CartLines {
  if (!Array.isArray(stored)) {
    return EMPTY_CART;
  }

  const seen = new Set<string>();
  const lines: CartLine[] = [];
  for (const entry of stored) {
    const line = restoreLine(entry);
    if (line !== undefined && !seen.has(line.productId)) {
      seen.add(line.productId);
      lines.push(line);
    }
  }

  return lines.length === 0 ? EMPTY_CART : lines;
}
