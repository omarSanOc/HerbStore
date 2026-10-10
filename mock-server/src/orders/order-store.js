import { randomUUID } from 'node:crypto';

import {
  createOrderFingerprint,
  OrderValidationError,
  validateOrderKey,
  validateOrderRequest,
} from './order-contract.js';
import { createOrderSummary } from './order-totals.js';

const HOUR_MS = 60 * 60 * 1000;
const ACTIVE_MS = 24 * HOUR_MS;
const RETENTION_MS = 48 * HOUR_MS;
const DEFAULT_PROCESSING_MS = 1_000;
const DEFAULT_AVAILABLE_STOCK = 99;

function clone(value) {
  return structuredClone(value);
}

export class OrderStore {
  constructor({
    products,
    clock = () => Date.now(),
    idFactory = randomUUID,
    processingMs = DEFAULT_PROCESSING_MS,
  }) {
    if (!Number.isFinite(processingMs) || processingMs < 0) {
      throw new TypeError('Order processing time must be a non-negative number.');
    }

    this.products = products;
    this.clock = clock;
    this.idFactory = idFactory;
    this.processingMs = processingMs;
    this.attempts = new Map();
    this.inventory = new Map(
      products.map((product) => [
        product.id,
        {
          available:
            Number.isSafeInteger(product.stock) && product.stock >= 0
              ? product.stock
              : product.inStock
                ? DEFAULT_AVAILABLE_STOCK
                : 0,
          reserved: 0,
        },
      ]),
    );
  }

  submit(rawKey, rawRequest) {
    let key;
    try {
      key = validateOrderKey(rawKey);
    } catch (error) {
      if (error instanceof OrderValidationError) {
        return { kind: 'validation_error', fields: error.fields };
      }
      throw error;
    }

    this.#refresh(key);
    const existing = this.attempts.get(key);
    if (existing?.status === 'expired') {
      return { kind: 'expired' };
    }

    let request;
    try {
      request = validateOrderRequest(rawRequest, this.products);
    } catch (error) {
      if (error instanceof OrderValidationError) {
        return { kind: 'validation_error', fields: error.fields };
      }
      throw error;
    }

    const fingerprint = createOrderFingerprint(request);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return {
          kind: 'idempotency_conflict',
          status: existing.status,
          statusPath: `/orders/status/${encodeURIComponent(key)}`,
        };
      }
      return this.#activeResult(existing);
    }

    const reservation = request.items.map(({ productId, quantity }) => ({
      productId,
      quantity,
    }));
    if (
      reservation.some(
        ({ productId, quantity }) =>
          this.inventory.get(productId).available < quantity,
      )
    ) {
      return { kind: 'out_of_stock' };
    }

    for (const { productId, quantity } of reservation) {
      const stock = this.inventory.get(productId);
      stock.available -= quantity;
      stock.reserved += quantity;
    }

    const createdAtMs = this.clock();
    const order = createOrderSummary({
      request,
      products: this.products,
      id: this.idFactory(),
      createdAt: new Date(createdAtMs).toISOString(),
    });
    const attempt = {
      key,
      fingerprint,
      createdAtMs,
      confirmAtMs: createdAtMs + this.processingMs,
      status: 'pending',
      reservation,
      order,
    };
    this.attempts.set(key, attempt);

    return this.#activeResult(attempt);
  }

  getStatus(rawKey) {
    if (typeof rawKey !== 'string' || rawKey.trim().length === 0) {
      return { kind: 'not_created' };
    }
    const key = rawKey.trim();
    this.#refresh(key);
    const attempt = this.attempts.get(key);
    if (!attempt) {
      return { kind: 'not_created' };
    }
    if (attempt.status === 'expired') {
      return { kind: 'expired' };
    }

    return this.#activeResult(attempt);
  }

  inspect() {
    return {
      attempts: Object.fromEntries(
        [...this.attempts.entries()].map(([key, attempt]) => [key, clone(attempt)]),
      ),
      inventory: Object.fromEntries(
        [...this.inventory.entries()].map(([id, stock]) => [id, clone(stock)]),
      ),
    };
  }

  #activeResult(attempt) {
    if (attempt.status === 'confirmed') {
      return { kind: 'confirmed', order: clone(attempt.order) };
    }

    const remainingMs = Math.max(0, attempt.confirmAtMs - this.clock());
    return {
      kind: 'pending',
      retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1_000)),
      key: attempt.key,
    };
  }

  #refresh(key) {
    const attempt = this.attempts.get(key);
    if (!attempt) {
      return;
    }

    const now = this.clock();
    if (now - attempt.createdAtMs >= RETENTION_MS) {
      this.attempts.delete(key);
      return;
    }
    if (now - attempt.createdAtMs >= ACTIVE_MS) {
      if (attempt.status === 'pending') {
        this.#release(attempt.reservation);
      }
      this.attempts.set(key, {
        key,
        status: 'expired',
        createdAtMs: attempt.createdAtMs,
        expiresAtMs: attempt.createdAtMs + RETENTION_MS,
      });
      return;
    }
    if (attempt.status === 'pending' && now >= attempt.confirmAtMs) {
      for (const { productId, quantity } of attempt.reservation) {
        this.inventory.get(productId).reserved -= quantity;
      }
      attempt.status = 'confirmed';
    }
  }

  #release(reservation) {
    for (const { productId, quantity } of reservation) {
      const stock = this.inventory.get(productId);
      stock.available += quantity;
      stock.reserved -= quantity;
    }
  }
}
