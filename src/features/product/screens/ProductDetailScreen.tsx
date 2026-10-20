import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { toApiError } from '@/core/api/api-error';
import { useRevalidateWhenStale } from '@/core/api/use-revalidate-when-stale';
import { useCurrentLanguage } from '@/core/i18n/use-current-language';
import { useScrollReveal } from '@/core/layout/use-scroll-reveal';
import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import {
  AppButton,
  AppSurface,
  AppText,
  fontScaleLimits,
  sizes,
  spacing,
  useAppTheme,
} from '@/design-system';
import { MessageScreen } from '@/features/navigation/screens/MessageScreen';
import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';
import { selectPreferredCurrency } from '@/features/preferences/store/preferences-slice';
import { acceptAddPress, toCartProduct } from '@/features/cart/logic/add-to-cart';
import { selectCartLines, selectIsCartLocked } from '@/features/cart/logic/cart-selectors';
import { addProductToCart } from '@/features/cart/store/add-to-cart';
import { stockRefreshed } from '@/features/cart/store/cart-slice';

import { ProductGallery } from '../components/ProductGallery';
import { QuantitySelector, type QuantityStepSource } from '../components/QuantitySelector';
import { StickyAddBar } from '../components/StickyAddBar';
import { AddToCartFeedback } from '../components/AddToCartFeedback';
import { ProductNoticeRow } from '../components/ProductNoticeRow';
import type { ProductDetail } from '../contracts/catalog-product';
import { useGetProductQuery } from '../data/products-api';
import { useProductShare } from '../hooks/use-product-share';
import { buildProductDetailModel, formatProductTotal } from '../logic/product-detail';
import {
  describeAddOutcome,
  INITIAL_ADD_FEEDBACK,
  nextAddFeedback,
} from '../logic/add-feedback';
import { classifyProductLookup, type ProductNotice } from '../logic/product-lookup';
import { clampQuantity, MIN_QUANTITY, stepQuantity, type QuantityChoice } from '../logic/quantity';
import { parseProductId } from '../parse-product-id';

type ProductDetailScreenProps = {
  /** Raw route param: may be missing, repeated (array) or malformed. */
  rawId: unknown;
};

/**
 * The product detail (spec 004, RF-4 to RF-6). The request is `getProduct` (RTK Query: remote
 * state) and `classifyProductLookup` (pure) turns `{ data, error, isFetching }` into the five
 * states of Day 2/3; `skipToken` is the RTK way of saying "do not run this query", so an id with an
 * invalid shape never reaches the network. The same 60 s rule as every screen revalidates it
 * (focus, foreground, reconnection), because the stock on screen is only as fresh as the last answer.
 *
 * Where each piece of state lives:
 * - remote (RTK Query): the product and its live `stock`;
 * - global (Redux): the preferred currency, read here and written in Account;
 * - local (this file): the chosen quantity, which dies with the screen. What reaches the cart is
 *   T4's dispatch, not the quantity itself.
 */
export function ProductDetailScreen({ rawId }: Readonly<ProductDetailScreenProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  const productId = parseProductId(rawId);
  const invalidLink = rawId === 'invalid';
  // The language of the read: part of the argument, so the detail of `es` and of `en` are two
  // entries. An invalid id never builds an argument at all (`skipToken`): zero requests (RF-40).
  const language = useCurrentLanguage();
  // `currentData`, NOT `data`: `data` keeps the answer of the PREVIOUS id while the new one loads,
  // and the product route is singular (product B REPLACES product A, it does not stack), so with
  // `data` the screen would show A's name, price and stock under B's id until B arrives. The same
  // holds for the previous language: `currentData` is only ever the answer for the current
  // `{ id, language }` argument (and survives a revalidation of those same args).
  const { currentData, error, isFetching, refetch, fulfilledTimeStamp } = useGetProductQuery(
    productId === undefined ? skipToken : { id: productId, language },
  );
  useRevalidateWhenStale({ fulfilledTimeStamp, isFetching, refetch });

  if (productId === undefined) {
    return (
      <NotFoundScreen
        message={t(invalidLink ? 'product.invalidMessage' : 'product.notFoundMessage')}
        title={t(invalidLink ? 'product.invalidTitle' : 'product.notFoundTitle')}
      />
    );
  }

  const state = classifyProductLookup({ data: currentData, error: toApiError(error), isFetching });
  const retry = () => {
    void refetch();
  };

  switch (state.status) {
    case 'loading':
      return (
        <MessageScreen title={t('product.loadingTitle')}>
          {/* Reduced motion (RF-15): the endless spinner is left out; the title says the same. */}
          {reduceMotion ? null : (
            <ActivityIndicator
              accessibilityLabel={t('product.loadingTitle')}
              color={colors.primary}
              size="large"
            />
          )}
        </MessageScreen>
      );
    case 'found':
      // `key`: the product route is singular, so opening product B from product A may REUSE this
      // component with another id. A new key remounts the content and the quantity of A does not
      // leak into B (the React way to "reset state when a prop changes", with no effect).
      return (
        <ProductDetailContent
          key={state.product.id}
          notice={state.notice}
          onRetry={retry}
          product={state.product}
        />
      );
    case 'not-found':
      return (
        <NotFoundScreen
          message={t('product.notFoundMessage')}
          title={t('product.notFoundTitle')}
        />
      );
    case 'offline':
      return (
        <MessageScreen message={t('product.offlineMessage')} title={t('product.offlineTitle')}>
          <AppButton
            accessibilityHint={t('product.retryHint')}
            label={t('product.retry')}
            onPress={retry}
          />
        </MessageScreen>
      );
    case 'error':
      return (
        <MessageScreen message={t('product.errorMessage')} title={t('product.errorTitle')}>
          <AppButton
            accessibilityHint={t('product.retryHint')}
            label={t('product.retry')}
            onPress={retry}
          />
        </MessageScreen>
      );
  }
}

type ProductDetailContentProps = {
  product: ProductDetail;
  /** Set when the last revalidation failed: price and stock may be old (RF-17). */
  notice?: ProductNotice;
  onRetry: () => void;
};

/**
 * What the screen shows once the product is known: gallery, texts, quantity and the pinned bar.
 *
 * The quantity is `useState` of the CHOICE the person made (`{ quantity, limited }`), and what is
 * drawn is always `clampQuantity(choice.quantity, stock)`: if a revalidation lowers the stock
 * under the selection, the screen shows the new maximum on the next render with no effect and no
 * second copy of the state to keep in sync. The stock limit is announced to the screen reader and
 * also written as text under the selector.
 *
 * A failed revalidation keeps the product and adds `ProductNoticeRow` on top (price and stock may be
 * old). In Kotlin it is a `sealed interface` with `Stale(data)`; in Swift an `enum` with an associated value.
 *
 * Compose: `var quantity by rememberSaveable { mutableIntStateOf(1) }` inside the screen and a
 * `Scaffold` with `bottomBar`; SwiftUI: `@State private var quantity = 1` and `.safeAreaInset`.
 */
function ProductDetailContent({ product, notice, onRetry }: Readonly<ProductDetailContentProps>) {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const currency = useAppSelector(selectPreferredCurrency);
  const cartLocked = useAppSelector(selectIsCartLocked);
  const cartLine = useAppSelector((state) =>
    selectCartLines(state).find((line) => line.productId === product.id),
  );
  const [choice, setChoice] = useState<QuantityChoice>({ quantity: MIN_QUANTITY, limited: false });
  const [feedback, setFeedback] = useState(INITIAL_ADD_FEEDBACK);
  const [addBarHeight, setAddBarHeight] = useState(0);
  const lastAcceptedAdd = useRef<number | undefined>(undefined);
  const { failed: shareFailed, share } = useProductShare(product);
  // The failed-share message appears under the Share button, which at a large font can be right above
  // the pinned bar: it is brought into sight when it appears (otherwise it lands under the bar).
  const shareErrorRef = useRef<View>(null);
  const { scrollRef, contentRef, onScroll, onLayout: onScrollLayout, reveal } = useScrollReveal(spacing.md);

  const { quantity } = clampQuantity(choice.quantity, product.stock);
  const model = buildProductDetailModel(product, i18n.language, currency, quantity);
  const soldOut = model.availability.kind === 'out_of_stock';
  const stockText = model.availability.kind === 'in_stock' ? model.availability.stockText : '';
  const limitText = t('product.quantity.maxReached', { count: product.stock, countText: stockText });
  const limitReached = choice.limited && !soldOut && quantity >= product.stock;

  useEffect(() => {
    // The detail owns the freshest stock. Refresh an existing offline snapshot, but never mutate
    // the cart before redux-persist has finished restoring it (the same guard used by Add).
    if (!cartLocked && cartLine !== undefined && cartLine.stock !== product.stock) {
      dispatch(stockRefreshed([{ productId: product.id, stock: product.stock }]));
    }
  }, [cartLine, cartLocked, dispatch, product.id, product.stock]);

  const onStep = (direction: 1 | -1, source: QuantityStepSource) => {
    const next = stepQuantity(quantity, direction, product.stock);
    setChoice(next);

    if (next.limited) {
      // Keeping the maximum changes nothing on screen to hear or feel: say it (RF-6).
      AccessibilityInfo.announceForAccessibility(limitText);
    } else if (source === 'button' && next.quantity !== quantity) {
      // A press on + / - does not move the screen reader focus, so it would never hear the new
      // amount. The adjustable gestures do read the new value by themselves.
      AccessibilityInfo.announceForAccessibility(
        t('product.quantity.changed', {
          quantity: next.quantity,
          total: formatProductTotal(product, next.quantity, i18n.language, currency),
        }),
      );
    }
  };

  const onAdd = () => {
    const now = Date.now();
    if (!acceptAddPress(lastAcceptedAdd.current, now)) {
      return;
    }
    lastAcceptedAdd.current = now;

    const outcome = dispatch(
      addProductToCart({ product: toCartProduct(product), quantity }),
    );
    const model = describeAddOutcome(outcome);
    if (model !== undefined) {
      setFeedback((current) => nextAddFeedback(current, model));
    }
  };

  const ratingText =
    model.rating === undefined ? t('productCard.noReviews') : `★ ${model.rating.value} (${model.rating.countText})`;
  const ratingSpoken =
    model.rating === undefined
      ? t('productCard.noReviews')
      : t('productCard.ratingSpoken', {
          count: model.rating.count,
          rating: model.rating.value,
          countText: model.rating.countText,
        });

  return (
    <AppSurface level="page" style={styles.page}>
      <ScrollView
        ref={scrollRef}
        testID="product-detail-scroll"
        contentContainerStyle={styles.scroll}
        contentInsetAdjustmentBehavior="automatic"
        onLayout={onScrollLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}>
        <View ref={contentRef} style={styles.column}>
          {/* At the TOP of the scroll, never under the pinned bar: a line that appears at the end of a
              scroll would fall behind it. It scrolls away with the content, so it never takes a
              share of the screen at large font sizes the way a fixed bar does. */}
          {notice === undefined ? null : (
            <View style={styles.notice}>
              <ProductNoticeRow notice={notice} onRetry={onRetry} />
            </View>
          )}
          <ProductGallery images={model.images} name={model.name} />
          <View style={styles.info}>
            <View style={styles.heading}>
              <AppText tone="muted">{model.brand}</AppText>
              {/* Capped: a long word of a name would be split in the middle at the largest sizes. */}
              <AppText
                accessibilityRole="header"
                maxFontSizeMultiplier={fontScaleLimits.productTitle}
                variant="heading">
                {model.name}
              </AppText>
              <AppText accessibilityLabel={ratingSpoken} tone="muted">
                {ratingText}
              </AppText>
            </View>

            <View
              accessibilityLabel={
                model.listPrice === undefined
                  ? model.price
                  : t('productCard.priceOffer', { price: model.price, listPrice: model.listPrice })
              }
              accessible
              style={styles.prices}>
              <AppText maxFontSizeMultiplier={fontScaleLimits.productTitle} variant="heading">
                {model.price}
              </AppText>
              {model.listPrice === undefined ? null : (
                <AppText style={styles.listPrice} tone="muted">
                  {model.listPrice}
                </AppText>
              )}
            </View>

            {/* Availability is TEXT (never only a color) and comes from the live stock number. */}
            <AppText variant="label">
              {model.availability.kind === 'in_stock'
                ? t('product.availability.inStock', {
                    count: model.availability.stock,
                    countText: model.availability.stockText,
                  })
                : t('product.availability.outOfStock')}
            </AppText>

            <View style={styles.serving}>
              <AppText tone="muted">{t('product.serving.size', { size: model.serving.size })}</AppText>
              <AppText tone="muted">
                {t('product.serving.perContainer', {
                  count: model.serving.servingsPerContainer,
                  countText: model.serving.countText,
                })}
              </AppText>
            </View>

            <View style={styles.action}>
              <AppButton
                accessibilityHint={t('product.share.hint')}
                label={t('product.share.button')}
                onPress={share}
              />
              {shareFailed ? (
                <View
                  ref={shareErrorRef}
                  testID="product-share-error"
                  onLayout={() => reveal(shareErrorRef.current)}
                  style={styles.shareError}>
                  <AppText maxFontSizeMultiplier={fontScaleLimits.inlineFeedback}>
                    {t('product.share.failed')}
                  </AppText>
                  <AppButton
                    accessibilityHint={t('product.share.retryHint')}
                    label={t('product.share.retry')}
                    maxFontSizeMultiplier={fontScaleLimits.inlineFeedback}
                    onPress={share}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <AppText
                accessibilityRole="header"
                maxFontSizeMultiplier={fontScaleLimits.sectionHeading}
                variant="subheading">
                {t('product.descriptionHeading')}
              </AppText>
              <AppText>{model.description}</AppText>
            </View>

            {soldOut ? null : (
              <View style={styles.section}>
                <AppText
                  accessibilityRole="header"
                  maxFontSizeMultiplier={fontScaleLimits.sectionHeading}
                  variant="subheading">
                  {t('product.quantity.heading')}
                </AppText>
                <QuantitySelector
                  limitReached={limitReached}
                  limitText={limitText}
                  onStep={onStep}
                  quantity={quantity}
                  stockText={stockText}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
      {feedback.model === undefined || addBarHeight === 0 ? null : (
        <View
          pointerEvents="none"
          style={[styles.feedbackLayer, { bottom: addBarHeight + spacing.sm }]}>
          <AddToCartFeedback key={feedback.id} model={feedback.model} />
        </View>
      )}
      <StickyAddBar
        locked={cartLocked}
        onAdd={onAdd}
        onHeightChange={setAddBarHeight}
        soldOut={soldOut}
        total={model.total}
      />
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  feedbackLayer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    elevation: 4,
    zIndex: 2,
  },
  scroll: {
    flexGrow: 1,
  },
  // The reading column never gets wider than on a phone-sized layout (tablets center it).
  column: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
  },
  notice: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  info: {
    gap: spacing.md,
    padding: spacing.md,
  },
  heading: {
    gap: spacing.xs,
  },
  prices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.sm,
  },
  listPrice: {
    textDecorationLine: 'line-through',
  },
  serving: {
    gap: spacing.xs,
  },
  action: {
    alignItems: 'flex-start',
  },
  shareError: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  section: {
    gap: spacing.sm,
  },
});
