import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText, RemoteImage, scaleWithFont, sizes, spacing, useAppTheme } from '@/design-system';
import { categoryInitial } from '@/features/categories/category-labels';

import type { HomeCategory } from '../contracts/home';
import { CATEGORY_IMAGE_SIZE, HOME_GUTTER } from '../home-layout';

const keyExtractor = (category: HomeCategory) => category.id;

type CategoryRowProps = {
  categories: readonly HomeCategory[];
  onOpenCategory: (categoryId: string) => void;
};

/** Titled horizontal row of circular categories. Each one is a button; its image is decorative. */
export function CategoryRow({ categories, onOpenCategory }: Readonly<CategoryRowProps>) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();

  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" variant="subheading">
        {t('home.rows.categories')}
      </AppText>
      <FlatList
        testID="category-row"
        // The gap grows with the font: a constant 8 dp left large labels almost touching (H-7).
        contentContainerStyle={[styles.content, { gap: scaleWithFont(spacing.sm, fontScale) }]}
        data={categories}
        horizontal
        keyExtractor={keyExtractor}
        renderItem={({ item }) => <CategoryItem category={item} onPress={onOpenCategory} />}
        showsHorizontalScrollIndicator={false}
        style={styles.list}
      />
    </View>
  );
}

function CategoryItem({
  category,
  onPress,
}: Readonly<{ category: HomeCategory; onPress: (categoryId: string) => void }>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  // RF-8, RF-22: the name is copy OF THE CATALOG, shown as the localized response sent it. The
  // translation-by-id this row used to keep replaced the server text for five known ids, so the
  // screen could disagree with the API; `categoryInitial` is the only thing derived from it.
  const name = category.name;

  return (
    <Pressable
      accessibilityHint={t('home.categoryHint')}
      accessibilityLabel={name}
      accessibilityRole="button"
      onPress={() => onPress(category.id)}
      style={({ pressed }) => [styles.item, pressed && !reduceMotion ? styles.pressed : null]}>
      <RemoteImage
        aspectRatio={1}
        fallbackText={categoryInitial(name)}
        path={category.imageUrl}
        style={[styles.image, { borderColor: colors.border }]}
      />
      <AppText style={styles.name} variant="label">
        {name}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  list: {
    marginHorizontal: -HOME_GUTTER,
  },
  content: {
    paddingHorizontal: HOME_GUTTER,
  },
  item: {
    // Grows with the label instead of clipping it; never narrower than the circle or the target.
    minWidth: Math.max(CATEGORY_IMAGE_SIZE, sizes.minimumTouchTarget),
    alignItems: 'center',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.72,
  },
  image: {
    width: CATEGORY_IMAGE_SIZE,
    borderRadius: CATEGORY_IMAGE_SIZE / 2,
    borderWidth: 1,
  },
  name: {
    // Wide enough that a single word is never split mid-word at the largest font; longer
    // (server fallback) names wrap at spaces.
    maxWidth: CATEGORY_IMAGE_SIZE * 3,
    textAlign: 'center',
  },
});
