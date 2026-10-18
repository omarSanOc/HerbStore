import type { Ref, RefObject } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ScreenReaderFocusTarget } from '@/core/accessibility/screen-reader-focus';
import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import {
  AppBottomSheet,
  AppText,
  fontScaleLimits,
  radii,
  sizes,
  spacing,
  useAppBottomSheet,
  useAppTheme,
  type AppBottomSheetHandle,
} from '@/design-system';

import { PRODUCT_SORTS, type ProductSort } from '../logic/product-query';

type SortSheetProps = {
  ref: Ref<AppBottomSheetHandle>;
  /** The applied sort: it is the one that shows as selected. */
  sort: ProductSort;
  /** Called with the chosen sort; the sheet closes itself right after. */
  onSelect: (sort: ProductSort) => void;
  /** The button that opens this sheet: the screen-reader focus goes back to it on close. */
  returnFocusTo?: RefObject<ScreenReaderFocusTarget | null>;
};

/** Translation key of each sort option (the values are exactly the five of RF-15). */
export const sortLabelKeys = {
  featured: 'productList.sort.options.featured',
  price_asc: 'productList.sort.options.price_asc',
  price_desc: 'productList.sort.options.price_desc',
  rating: 'productList.sort.options.rating',
  best_selling: 'productList.sort.options.best_selling',
} as const satisfies Record<ProductSort, string>;

/**
 * The sort options in a bottom sheet (RF-15): five radio rows, the applied one selected. Choosing
 * one applies it at once and closes the sheet; the list starts again on page 1 because the sort
 * is part of the query identity. The sheet mechanics (title, visible Close, Android Back, drag
 * down, reduced motion, accessibility) live in `AppBottomSheet`.
 *
 * Compose: `ModalBottomSheet` with a column of `Row(Modifier.selectable(role = Role.RadioButton))`.
 * SwiftUI: `.sheet` with `.presentationDetents([.medium])` and a `Picker` or a list of buttons.
 */
export function SortSheet({ ref, sort, onSelect, returnFocusTo }: Readonly<SortSheetProps>) {
  const { t } = useTranslation();

  return (
    <AppBottomSheet
      ref={ref}
      closeHint={t('productList.sort.closeHint')}
      closeLabel={t('productList.sort.close')}
      name="sort"
      returnFocusTo={returnFocusTo}
      title={t('productList.sort.title')}>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {PRODUCT_SORTS.map((option) => (
          <SortOption
            key={option}
            label={t(sortLabelKeys[option])}
            onPress={() => onSelect(option)}
            selected={option === sort}
          />
        ))}
      </View>
    </AppBottomSheet>
  );
}

type SortOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/**
 * One radio row. The role is `radio` and the state is `checked`: iOS speaks "radio button,
 * checked" and TalkBack "selected". Sighted users get a check mark, a thicker border and bolder
 * text, so the active option does not depend on color alone.
 */
function SortOption({ label, selected, onPress }: Readonly<SortOptionProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { dismiss } = useAppBottomSheet();
  const reduceMotion = useReducedMotionPreference();

  return (
    <Pressable
      accessibilityHint={t('productList.sort.optionHint')}
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        // Apply first, then close: the list already shows the new order when the sheet leaves. The
        // focus goes back to the sort button, whose label now names the new order.
        onPress();
        dismiss();
      }}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? colors.primary : colors.controlBorder,
          // A border of constant width, so selecting does not move the text.
          borderWidth: selected ? 2 : 1,
        },
        pressed && !reduceMotion ? styles.pressed : null,
      ]}>
      <AppText
        maxFontSizeMultiplier={fontScaleLimits.optionLabel}
        style={styles.optionLabel}
        variant={selected ? 'label' : 'body'}>
        {label}
      </AppText>
      {/* A slot of fixed width: the mark never takes width the label needs, so a word is not split. */}
      <View style={styles.checkSlot}>
        <AppText
          accessibilityElementsHidden
          importantForAccessibility="no"
          maxFontSizeMultiplier={fontScaleLimits.selectionMark}
          style={{ color: colors.primary }}
          variant="label">
          {selected ? '✓' : ''}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: sizes.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  // `flex: 1` + `minWidth: 0`: the label takes exactly the space left by the check slot and wraps
  // between words inside it (without `minWidth: 0` a row child never shrinks below its content).
  optionLabel: {
    flex: 1,
    minWidth: 0,
  },
  checkSlot: {
    width: spacing.lg,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
