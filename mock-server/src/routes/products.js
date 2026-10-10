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

export function createProductsRouter(products) {
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

      response.json(product);
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

      response.json(product);
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
