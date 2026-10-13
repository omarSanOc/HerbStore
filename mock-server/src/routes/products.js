import { Router } from 'express';

import {
  isValidEan13,
  parseProductQuery,
  ProductQueryError,
  selectProducts,
} from '../catalog/query-products.js';
import {
  parseFailQuery,
  sendError,
  sendInvalidQuery,
  sendSimulatedFailure,
} from './http-response.js';

function sendProductNotFound(response) {
  sendError(response, 404, 'PRODUCT_NOT_FOUND', 'The product was not found.');
}

/**
 * The detail of a product: the catalog entry plus the LIVE stock. `inStock` is derived from it, so
 * it can differ from the (static) value that lists and Home keep showing for the same product.
 * Returns a copy: the catalog itself is never mutated.
 */
function toDetail(product, readStock) {
  const stock = readStock(product.id) ?? 0;

  return { ...product, stock, inStock: stock > 0 };
}

/**
 * @param {import('../catalog/product-contract.js').Product[]} products
 * @param {(productId: string) => number | undefined} readStock units available now; only the two
 *   detail endpoints use it, lists and search keep the catalog as generated.
 */
export function createProductsRouter(products, readStock) {
  const router = Router();

  router.get('/', (request, response) => {
    try {
      const query = parseProductQuery(request.query);
      if (query.fail) {
        sendSimulatedFailure(response);
        return;
      }

      response.json(selectProducts(products, query));
    } catch (error) {
      if (error instanceof ProductQueryError) {
        sendInvalidQuery(response);
        return;
      }
      throw error;
    }
  });

  router.get('/barcode/:code', (request, response) => {
    try {
      if (parseFailQuery(request.query.fail)) {
        sendSimulatedFailure(response);
        return;
      }
      if (!isValidEan13(request.params.code)) {
        sendError(
          response,
          400,
          'INVALID_BARCODE',
          'The barcode must be a valid EAN-13 value.',
        );
        return;
      }

      const product = products.find(({ ean13 }) => ean13 === request.params.code);
      if (!product) {
        sendProductNotFound(response);
        return;
      }

      response.json(toDetail(product, readStock));
    } catch (error) {
      if (error instanceof ProductQueryError) {
        sendInvalidQuery(response);
        return;
      }
      throw error;
    }
  });

  router.get('/:id', (request, response) => {
    try {
      if (parseFailQuery(request.query.fail)) {
        sendSimulatedFailure(response);
        return;
      }

      const product = products.find(({ id }) => id === request.params.id);
      if (!product) {
        sendProductNotFound(response);
        return;
      }

      response.json(toDetail(product, readStock));
    } catch (error) {
      if (error instanceof ProductQueryError) {
        sendInvalidQuery(response);
        return;
      }
      throw error;
    }
  });

  return router;
}
