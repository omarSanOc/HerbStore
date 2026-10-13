import { pathToFileURL } from 'node:url';

import express from 'express';

import { generateCatalog } from './catalog/generate-catalog.js';
import { OrderStore } from './orders/order-store.js';
import { createBrandsRouter } from './routes/brands.js';
import { createCategoriesRouter } from './routes/categories.js';
import { createHomeRouter } from './routes/home.js';
import { createImagesRouter } from './routes/images.js';
import { sendError } from './routes/http-response.js';
import { createOrdersRouter } from './routes/orders.js';
import { createProductsRouter } from './routes/products.js';

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_LATENCY_MS = 0;
const catalog = generateCatalog();

function readLatency(value) {
  const latency = value === undefined ? DEFAULT_LATENCY_MS : Number(value);
  if (!Number.isFinite(latency) || latency < 0) {
    throw new TypeError('Catalog latency must be a non-negative number.');
  }

  return latency;
}

function readOrderProcessingTime(value) {
  if (value === undefined) {
    return undefined;
  }
  const processingMs = Number(value);
  if (!Number.isFinite(processingMs) || processingMs < 0) {
    throw new TypeError('Order processing time must be a non-negative number.');
  }

  return processingMs;
}

function readOrderActiveTime(value) {
  if (value === undefined) return undefined;
  const activeMs = Number(value);
  if (!Number.isFinite(activeMs) || activeMs <= 0) throw new TypeError('Order active time must be positive.');
  return activeMs;
}

function readOrderPostDelay(value) {
  if (value === undefined) return 0;
  const delayMs = Number(value);
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new TypeError('Order POST delay must be non-negative.');
  return delayMs;
}

function wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

export function createApp({
  latencyMs = process.env.MOCK_LATENCY_MS,
  orderClock,
  orderIdFactory,
  orderProcessingMs = process.env.ORDER_PROCESSING_MS,
  orderPostDelayMs = process.env.ORDER_POST_DELAY_MS,
  orderPostFault = process.env.ORDER_POST_FAULT,
  orderActiveMs = process.env.ORDER_ACTIVE_MS,
} = {}) {
  const app = express();
  const catalogLatencyMs = readLatency(latencyMs);
  const parsedOrderProcessingMs = readOrderProcessingTime(orderProcessingMs);
  const parsedOrderActiveMs = readOrderActiveTime(orderActiveMs);
  const parsedOrderPostDelayMs = readOrderPostDelay(orderPostDelayMs);
  if (orderPostFault !== undefined && !['server-error', 'inconsistent'].includes(orderPostFault)) {
    throw new TypeError('Unknown order POST fault.');
  }
  const orderStore = new OrderStore({
    products: catalog,
    ...(orderClock === undefined ? {} : { clock: orderClock }),
    ...(orderIdFactory === undefined ? {} : { idFactory: orderIdFactory }),
    ...(parsedOrderProcessingMs === undefined
      ? {}
      : { processingMs: parsedOrderProcessingMs }),
    ...(parsedOrderActiveMs === undefined ? {} : { activeMs: parsedOrderActiveMs }),
  });

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });
  app.use(
    ['/home', '/categories', '/products', '/brands'],
    async (_request, _response, next) => {
      await wait(catalogLatencyMs);
      next();
    },
  );
  app.use('/home', createHomeRouter(catalog));
  app.use('/categories', createCategoriesRouter(catalog));
  app.use(
    '/products',
    createProductsRouter(catalog, (id) => orderStore.availableStock(id)),
  );
  app.use('/brands', createBrandsRouter(catalog));
  app.use('/orders', createOrdersRouter(orderStore, { postDelayMs: parsedOrderPostDelayMs, postFault: orderPostFault }));
  // Generated placeholders: outside the catalog latency on purpose (image speed is not under test).
  app.use('/images', createImagesRouter(catalog));

  app.use((_request, response) => {
    sendError(response, 404, 'NOT_FOUND', 'The requested route was not found.');
  });

  app.use((error, _request, response, _next) => {
    if (error?.type === 'entity.too.large') {
      sendError(
        response,
        413,
        'PAYLOAD_TOO_LARGE',
        'The request body is too large.',
      );
      return;
    }
    if (error instanceof SyntaxError && error.status === 400) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Order request validation failed',
        },
        fields: { root: 'INVALID_FORMAT' },
      });
      return;
    }
    console.error('Unexpected mock server error:', error?.message ?? 'unknown');
    sendError(
      response,
      500,
      'INTERNAL_ERROR',
      'An unexpected server error occurred.',
    );
  });

  return app;
}

export function startServer({
  host = process.env.HOST ?? DEFAULT_HOST,
  port = Number(process.env.PORT ?? DEFAULT_PORT),
} = {}) {
  return createApp().listen(port, host, () => {
    console.log(`HerbStore mock server listening on http://${host}:${port}`);
  });
}

const isEntryPoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  startServer();
}
