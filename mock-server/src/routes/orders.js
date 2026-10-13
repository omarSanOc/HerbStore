import { Router } from 'express';

const MESSAGES = Object.freeze({
  VALIDATION_ERROR: 'Order request validation failed',
  IDEMPOTENCY_KEY_REUSED:
    'The idempotency key is already associated with another request',
  OUT_OF_STOCK: 'One or more products do not have enough stock',
  ORDER_NOT_CREATED: 'No order attempt exists for this key',
  IDEMPOTENCY_KEY_EXPIRED: 'The idempotency key has expired',
});

function sendOrderResult(response, result, { includeKey = false } = {}) {
  switch (result.kind) {
    case 'pending':
      response.status(202).json({
        status: 'pending',
        retryAfterSeconds: result.retryAfterSeconds,
        ...(includeKey ? { key: result.key } : {}),
      });
      return;
    case 'confirmed':
      response.json({ status: 'confirmed', order: result.order });
      return;
    case 'validation_error':
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: MESSAGES.VALIDATION_ERROR,
        },
        fields: result.fields,
      });
      return;
    case 'idempotency_conflict':
      response.status(409).json({
        status: result.status,
        links: { status: result.statusPath },
        error: {
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: MESSAGES.IDEMPOTENCY_KEY_REUSED,
        },
      });
      return;
    case 'out_of_stock':
      response.status(409).json({
        error: {
          code: 'OUT_OF_STOCK',
          message: MESSAGES.OUT_OF_STOCK,
        },
      });
      return;
    case 'not_created':
      response.status(404).json({
        status: 'not_created',
        error: {
          code: 'ORDER_NOT_CREATED',
          message: MESSAGES.ORDER_NOT_CREATED,
        },
      });
      return;
    case 'expired':
      response.status(410).json({
        status: 'expired',
        error: {
          code: 'IDEMPOTENCY_KEY_EXPIRED',
          message: MESSAGES.IDEMPOTENCY_KEY_EXPIRED,
        },
      });
      return;
    default:
      throw new TypeError('Unknown order result.');
  }
}

export function createOrdersRouter(orderStore, { postDelayMs = 0, postFault } = {}) {
  const router = Router();

  router.get('/status/:key', (request, response) => {
    sendOrderResult(response, orderStore.getStatus(request.params.key));
  });

  router.post('/', (request, response) => {
    const result = orderStore.submit(
      request.get('Idempotency-Key'),
      request.body,
    );
    const reply = () => {
      if (postFault === 'server-error') {
        response.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE' } });
        return;
      }
      if (postFault === 'inconsistent') {
        response.status(409).json({ status: 'confirmed', error: { code: 'OUT_OF_STOCK' } });
        return;
      }
      sendOrderResult(response, result, { includeKey: true });
    };
    if (postDelayMs > 0) setTimeout(reply, postDelayMs);
    else reply();
  });

  return router;
}
