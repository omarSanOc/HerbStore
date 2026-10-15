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

type Translate = (key: string, options?: Record<string, string>) => string;

export type ProductShareRequest = Readonly<{
  /** The app link, also embedded in `content.message`. */
  url: string;
  content: Readonly<{ title: string; message: string }>;
  options: Readonly<{ dialogTitle: string; subject: string }>;
}>;

/**
 * Everything the native share sheet receives, built with the ACTIVE language (`translate` is the
 * `t` of the current i18n instance, so a language switch is picked up by the next share). The link
 * travels INSIDE `message` on purpose: Android's chooser ignores a separate `url` field and only
 * sends `message`, so one text reads the same on both platforms. `undefined` when the id would not
 * produce a link the router accepts.
 */
export function buildProductShareRequest(
  product: Readonly<{ id: string; name: string }>,
  translate: Translate,
): ProductShareRequest | undefined {
  const url = buildProductShareUrl(product.id);
  if (url === undefined) {
    return undefined;
  }

  return {
    url,
    content: {
      title: product.name,
      message: translate('product.share.message', { name: product.name, url }),
    },
    options: {
      dialogTitle: translate('product.share.dialogTitle'),
      subject: product.name,
    },
  };
}
