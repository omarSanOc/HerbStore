// The link a shared product carries (spec 004, RF-4). Pure: no React Native, so `test:logic`
// runs it and checks it against the same normalizer the router uses for incoming links.
//
// The scheme is the one of `app.json` (`herbstore`). The route it opens is `product/<id>`, which
// `core/navigation/linking.ts` validates; a test keeps the two in step. Verifying that the OS opens
// the link from other apps is Day 5 (native share and deep links).

import { parseProductId } from '../parse-product-id.ts';

const APP_SCHEME = 'herbstore';

/**
 * `herbstore://product/<id>` for a catalog product id, `undefined` for anything else: a link is
 * never built from an id that the product route would reject.
 */
export function buildProductShareUrl(productId: string): string | undefined {
  const id = parseProductId(productId);

  return id === undefined ? undefined : `${APP_SCHEME}://product/${id}`;
}
