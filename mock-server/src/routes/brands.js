import { Router } from 'express';

import { createBrandData } from '../catalog/home-data.js';
import { ProductQueryError } from '../catalog/query-products.js';
import {
  parseFailQuery,
  sendInvalidQuery,
  sendSimulatedFailure,
} from './http-response.js';

export function createBrandsRouter(products) {
  const router = Router();
  const brands = createBrandData(products);

  router.get('/', (request, response) => {
    try {
      if (parseFailQuery(request.query.fail)) {
        sendSimulatedFailure(response);
        return;
      }

      response.json(brands);
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
