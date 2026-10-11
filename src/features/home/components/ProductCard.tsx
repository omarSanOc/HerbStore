import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText, RemoteImage, radii, spacing, useAppTheme } from '@/design-system';
import { buildProductCardModel } from '@/features/product/logic/product-card';
import { getProductCardWidth } from '@/features/product/logic/product-card-layout';

import type { HomeProduct } from '../contracts/home';
import { PRODUCT_CARD_WIDTH } from '../home-layout';

type ProductCardProps = {
  product: HomeProduct;
  onPress: (productId: string) => void;
};

/**
 * One product in a horizontal section. The whole card is a single accessible button whose spoken
 * label carries the name, the price (and "on sale" with the previous price), the rating and the
 * badge; the picture and the visible texts are not read a second time. What to show and how to
 * format it lives in `buildProductCardModel` (pure); this component lays it out.
 *
 * The width follows the system font scale up to 1.5x (`getProductCardWidth`) and the height is
 * never fixed: the text wraps and the card grows, so nothing is clipped. Cards in the same row stretch to the tallest one.
 */
export function ProductCard({ product, onPress }: Readonly<ProductCardProps>) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  const { fontScale } = useWindowDimensions();
  const width = getProductCardWidth(PRODUCT_CARD_WIDTH, fontScale);
  const model = buildProductCardModel(product, i18n.language);
  const { rating, badge } = model;

  const spokenParts = [
    model.name,
    model.listPrice === undefined
      ? model.price
      : t('home.product.priceOffer', { price: model.price, listPrice: model.listPrice }),
    rating === undefined
      ? t('home.product.noReviews')
      : t('home.product.ratingSpoken', {
          count: rating.count,
          rating: rating.value,
          countText: rating.countText,
        }),
    // The offer is already spoken with the price; "new" and "best seller" are not.
    badge === 'new' || badge === 'best_seller' ? t(`home.product.badge.${badge}`) : undefined,
  ];

  return (
    <Pressable
      accessibilityHint={t('home.product.hint')}
      accessibilityLabel={spokenParts.filter(Boolean).join('. ')}
      accessibilityRole="button"
      onPress={() => onPress(product.id)}
      style={({ pressed }) => [
        styles.card,
        { width, backgroundColor: colors.surface, borderColor: colors.border },
        pressed && !reduceMotion ? styles.pressed : null,
      ]}>
      <View>
        <RemoteImage
          aspectRatio={1}
          fallbackText={t('image.unavailable')}
          path={product.images[0]}
        />
        {badge === undefined ? null : (
          <View style={[styles.badge, { maxWidth: width - spacing.md * 2, backgroundColor: colors.primary }]}>
            {/* Capped: the badge is also in the spoken label and sits over a fixed-size picture. */}
            <AppText
              maxFontSizeMultiplier={1.5}
              style={styles.badgeText}
              tone="onPrimary"
              variant="label">
              {t(`home.product.badge.${badge}`)}
            </AppText>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <AppText variant="label">{model.name}</AppText>
        <View style={styles.prices}>
          <AppText variant="label">{model.price}</AppText>
          {model.listPrice === undefined ? null : (
            <AppText style={styles.listPrice} tone="muted">
              {model.listPrice}
            </AppText>
          )}
        </View>
        <AppText style={styles.rating} tone="muted">
          {rating === undefined ? t('home.product.noReviews') : `★ ${rating.value} (${rating.countText})`}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.72,
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
  badgeText: {
    fontSize: 13,
    lineHeight: 16,
  },
  body: {
    gap: spacing.xs,
    padding: spacing.sm,
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
  rating: {
    fontSize: 14,
    lineHeight: 20,
  },
});
