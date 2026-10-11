import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, spacing } from '@/design-system';

import type { HomeProduct, HomeSection } from '../contracts/home';
import { HOME_GUTTER } from '../home-layout';
import { ProductCard } from './ProductCard';

// Module-level and closure-free: the list receives the same function on every render. The key is
// the product id, never the position, so a reorder or a refresh does not remount the cards.
const keyExtractor = (product: HomeProduct) => product.id;

type ProductSectionProps = {
  section: HomeSection;
  onOpenProduct: (productId: string) => void;
};

/**
 * A titled horizontal row of product cards. `buildHomeRows` never produces a row for an empty
 * section, so this component can assume it has items (RF-15 is decided upstream).
 *
 * Sections hold at most 10 products, so `FlatList`'s default window renders them all at once:
 * the height of the row is known from the first frame and does not change while scrolling.
 */
export function ProductSection({ section, onOpenProduct }: Readonly<ProductSectionProps>) {
  const { t } = useTranslation();

  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" variant="subheading">
        {/* Our resources by section id; the server text (English) is only the fallback. */}
        {t(`home.sections.${section.id}`, { defaultValue: section.title })}
      </AppText>
      <FlatList
        contentContainerStyle={styles.content}
        data={section.items}
        horizontal
        keyExtractor={keyExtractor}
        renderItem={({ item }) => <ProductCard onPress={onOpenProduct} product={item} />}
        showsHorizontalScrollIndicator={false}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  // The page pads its content; the list cancels that padding so cards scroll edge to edge and
  // pads its own content so the first card still lines up with the title.
  list: {
    marginHorizontal: -HOME_GUTTER,
  },
  content: {
    gap: spacing.sm,
    paddingHorizontal: HOME_GUTTER,
  },
});
