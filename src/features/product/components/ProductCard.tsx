import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { useAppSelector } from '@/core/store/hooks';
import { AppText, RemoteImage, fontScaleLimits, radii, spacing, useAppTheme } from '@/design-system';
import { selectPreferredCurrency } from '@/features/preferences/store/preferences-slice';

import type { CatalogProduct } from '../contracts/catalog-product';
import { buildProductCardModel } from '../logic/product-card';

type ProductCardProps = {
  product: CatalogProduct;
  onPress: (productId: string) => void;
  /**
   * Fixed width in dp. Home's horizontal rows pass the Day 2 width (it grows with the font scale,
   * see `getProductCardWidth`). Without it the card fills the cell it is placed in: the width
   * belongs to whoever lays the cards out (a row, a grid column), not to the card.
   */
  width?: number;
};

/**
 * One product, shared by Home's horizontal rows and the category grid. The whole card is a single
 * accessible button whose spoken label carries, in this order, the name, the price (and "on sale"
 * with the previous price), the rating, the availability when the product is out of stock, and the
 * badge; the hint is the action. The picture and the visible texts are not read a second time.
 * What to show and how to format it lives in `buildProductCardModel` (pure); this component lays
 * it out. Prices are shown in the preferred currency (Account), converted at 1 USD = 18 MXN.
 *
 * Availability is text ("Out of stock") and part of the spoken label, never only a color or a
 * dimmed picture (RNF-2). The height is never fixed: the text wraps and the card grows, so nothing
 * is clipped. In a row or a grid row, cards stretch to the tallest one.
 */
export function ProductCard({ product, onPress, width }: Readonly<ProductCardProps>) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  // Each card reads the preferred currency itself, so changing it in Account repaints every
  // visible card whatever list (Home row, grid, search) holds it.
  const currency = useAppSelector(selectPreferredCurrency);
  const model = buildProductCardModel(product, i18n.language, currency);
  const { rating, badge } = model;

  const spokenParts = [
    model.name,
    model.listPrice === undefined
      ? model.price
      : t('productCard.priceOffer', { price: model.price, listPrice: model.listPrice }),
    rating === undefined
      ? t('productCard.noReviews')
      : t('productCard.ratingSpoken', {
          count: rating.count,
          rating: rating.value,
          countText: rating.countText,
        }),
    model.inStock ? undefined : t('productCard.outOfStock'),
    // The offer is already spoken with the price; "new" and "best seller" are not.
    badge === 'new' || badge === 'best_seller' ? t(`productCard.badge.${badge}`) : undefined,
  ];

  return (
    <Pressable
      accessibilityHint={t('productCard.hint')}
      accessibilityLabel={spokenParts.filter(Boolean).join('. ')}
      accessibilityRole="button"
      onPress={() => onPress(product.id)}
      style={({ pressed }) => [
        styles.card,
        width === undefined ? styles.fill : { width },
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && !reduceMotion ? styles.pressed : null,
      ]}>
      <View>
        <RemoteImage
          aspectRatio={1}
          fallbackText={t('image.unavailable')}
          path={product.images[0]}
        />
        {badge === undefined ? null : (
          // The badge row spans the picture minus the margins, so a long translation shrinks
          // instead of overflowing, whatever the width of the card.
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              {/* Capped: the badge is also in the spoken label and sits over a fixed-size picture. */}
              <AppText
                maxFontSizeMultiplier={1.5}
                style={styles.badgeText}
                tone="onPrimary"
                variant="label">
                {t(`productCard.badge.${badge}`)}
              </AppText>
            </View>
          </View>
        )}
      </View>
      <View style={styles.body}>
        {/* The card keeps its own width, so its texts scale only up to `cardText` (a word is never split). */}
        <AppText maxFontSizeMultiplier={fontScaleLimits.cardText} variant="label">{model.name}</AppText>
        <View style={styles.prices}>
          <AppText maxFontSizeMultiplier={fontScaleLimits.cardText} variant="label">{model.price}</AppText>
          {model.listPrice === undefined ? null : (
            <AppText maxFontSizeMultiplier={fontScaleLimits.cardText} style={styles.listPrice} tone="muted">
              {model.listPrice}
            </AppText>
          )}
        </View>
        <AppText maxFontSizeMultiplier={fontScaleLimits.cardText} style={styles.rating} tone="muted">
          {rating === undefined ? t('productCard.noReviews') : `★ ${rating.value} (${rating.countText})`}
        </AppText>
        {model.inStock ? null : (
          <AppText maxFontSizeMultiplier={fontScaleLimits.cardText} style={styles.stock} variant="label">
            {t('productCard.outOfStock')}
          </AppText>
        )}
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
  // No width: the card takes the width of its cell and grows to the height of its row.
  fill: {
    flexGrow: 1,
  },
  pressed: {
    opacity: 0.72,
  },
  badgeRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    // Same right margin as the Day 2 `maxWidth` (card width - 2 * md), so Home looks the same.
    right: spacing.lg,
    flexDirection: 'row',
  },
  badge: {
    flexShrink: 1,
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
  stock: {
    fontSize: 14,
    lineHeight: 20,
  },
});
