import { useState } from 'react';
import { AccessibilityInfo, Share } from 'react-native';
import { useTranslation } from 'react-i18next';

import { buildProductShareRequest } from '../logic/product-share';
import { createShareRunner } from '../logic/product-share-outcome';

type SharedProduct = Readonly<{ id: string; name: string }>;

/**
 * Shares a product with the system sheet and keeps the screen recoverable (spec 005, RF-26).
 * It never touches the cart or an order: sharing only reads the product.
 *
 * - success and cancel are silent and clear any earlier error (cancelling is not a failure);
 * - a rejection, a synchronous throw or a missing native result sets `failed`, which the screen
 *   shows as a localized message with a retry, and is announced once through
 *   `announceForAccessibility` (the same route as every other confirmation of the app);
 * - a press while a share is in flight is ignored (`createShareRunner`).
 *
 * Compose: `context.startActivity(Intent.createChooser(Intent(ACTION_SEND)...))`, which tells you
 * nothing about the outcome; SwiftUI: `ShareLink` (no result) or `UIActivityViewController` with
 * `completionWithItemsHandler`, which does report `completed`.
 */
export function useProductShare(product: SharedProduct) {
  const { t } = useTranslation();
  const [run] = useState(createShareRunner);
  const [failed, setFailed] = useState(false);

  const share = () => {
    const request = buildProductShareRequest(product, t);
    if (request === undefined) {
      return;
    }

    void run(() => Share.share(request.content, request.options)).then((outcome) => {
      if (__DEV__) {
        // Android resolves `shared` for a cancel too (see `product-share-outcome.ts`): this line is how
        // the validation tells the platforms apart.
        console.log(`[share] outcome=${outcome}`);
      }
      if (outcome === 'ignored') {
        return;
      }

      setFailed(outcome === 'failed');
      if (outcome === 'failed') {
        AccessibilityInfo.announceForAccessibility(t('product.share.failed'));
      }
    });
  };

  return { failed, share };
}
