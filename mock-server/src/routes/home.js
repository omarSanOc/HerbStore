import { Router } from 'express';

import { createHomeData } from '../catalog/home-data.js';
import { ProductQueryError } from '../catalog/query-products.js';
import {
  parseFailQuery,
  sendInvalidQuery,
  sendSimulatedFailure,
} from './http-response.js';

export function createHomeRouter(products) {
  const router = Router();
  const homeData = createHomeData(products);

  router.get('/', (request, response) => {
    try {
      if (parseFailQuery(request.query.fail)) {
        sendSimulatedFailure(response);
        return;
      }

      response.json(homeData);
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
