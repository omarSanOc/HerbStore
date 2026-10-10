import { Router } from 'express';

import { createCategoryTree } from '../catalog/home-data.js';
import { ProductQueryError } from '../catalog/query-products.js';
import {
  parseFailQuery,
  sendInvalidQuery,
  sendSimulatedFailure,
} from './http-response.js';

export function createCategoriesRouter(products) {
  const router = Router();
  const categories = createCategoryTree(products);

  router.get('/', (request, response) => {
    try {
      if (parseFailQuery(request.query.fail)) {
        sendSimulatedFailure(response);
        return;
      }

      response.json(categories);
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
