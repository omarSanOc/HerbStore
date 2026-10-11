import { Router } from 'express';

import { HOME_BANNERS } from '../catalog/home-data.js';
import { createPlaceholderPng } from '../catalog/placeholder-png.js';
import { sendError } from './http-response.js';

const ONE_DAY_SECONDS = 86_400;

const IMAGE_SIZES = Object.freeze({
  banners: { width: 640, height: 360 },
  categories: { width: 128, height: 128 },
  products: { width: 256, height: 256 },
});

/**
 * Names served for each kind, derived from the same data that builds `/home` and the catalog
 * (`<name>.png`). The request is only ever compared against this closed set: it never reaches
 * the file system, so a path like `../x` is simply an unknown name.
 */
function listImageNames(products) {
  const categoryIds = new Set(products.map(({ categoryId }) => categoryId));

  return {
    banners: new Set(HOME_BANNERS.map(({ id }) => `${id}.png`)),
    categories: new Set([...categoryIds].map((id) => `${id}.png`)),
    products: new Set(
      products
        .flatMap(({ images }) => images)
        .map((path) => path.slice(path.lastIndexOf('/') + 1)),
    ),
  };
}

export function createImagesRouter(products) {
  const router = Router();
  const names = listImageNames(products);
  const rendered = new Map();

  router.get('/:kind/:name', (request, response) => {
    const { kind, name } = request.params;
    const size = Object.hasOwn(IMAGE_SIZES, kind) ? IMAGE_SIZES[kind] : undefined;

    if (size === undefined || !names[kind].has(name)) {
      sendError(response, 404, 'NOT_FOUND', 'The requested route was not found.');
      return;
    }

    const key = `${kind}/${name}`;
    let png = rendered.get(key);
    if (png === undefined) {
      png = createPlaceholderPng({ ...size, seed: key });
      rendered.set(key, png);
    }

    response
      .type('image/png')
      .set('Cache-Control', `public, max-age=${ONE_DAY_SECONDS}`)
      .set('X-Content-Type-Options', 'nosniff')
      .send(png);
  });

  return router;
}
