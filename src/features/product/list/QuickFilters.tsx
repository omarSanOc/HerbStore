import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText, radii, sizes, spacing, useAppTheme } from '@/design-system';

import { getFilterItemMaxWidth } from '../logic/filter-bar-layout';
import { QUICK_FILTER_KEYS, type ListParams, type QuickFilterKey } from '../logic/list-params';
import { GRID_CELL_PADDING, GRID_EDGE_PADDING } from './grid-layout';

type QuickFiltersProps = {
  params: ListParams;
  onToggle: (key: QuickFilterKey) => void;
  /**
   * Shown before the chips and scrolling with them (the sort button and the advanced-filters
   * button), each with a stable `key`. Every item is capped at one viewport like a chip, so its text
   * wraps between words instead of becoming one line wider than the screen.
   */
  leading?: readonly Readonly<{ key: string; node: ReactNode }>[];
};

const labelKeys = {
  inStock: 'productList.filters.inStock',
  topRated: 'productList.filters.topRated',
  ownBrand: 'productList.filters.ownBrand',
  subscribeAndSave: 'productList.filters.subscribeAndSave',
} as const;

/**
 * The row of quick filters (RF-13): Available, 4★ or more, Own brand and Subscribe & save. One
 * horizontal scroll row, so it never grows taller than a chip however large the font is.
 *
 * Each chip is a button with `accessibilityState.selected`, which TalkBack and VoiceOver announce
 * as "selected". The selection is also visible WITHOUT color: a filled chip with a check mark.
 * The check is hidden from screen readers (the state already says it), and the chip label is
 * the accessible name.
 *
 * A horizontal scroll view gives its content no width limit, so a `Text` inside never wraps on its
 * own and a long label becomes one line wider than the screen. Every item (the leading button and
 * the chips) is capped at the width the row shows (`getFilterItemMaxWidth`), so its label wraps
 * between words and is read whole. Compose: `Modifier.widthIn(max = ...)` on an item of the
 * `LazyRow` (a `Text` wraps with `softWrap`). SwiftUI: `.frame(maxWidth:)` plus
 * `.fixedSize(horizontal: false, vertical: true)` inside a horizontal `ScrollView`.
 *
 * Compose: a `LazyRow` of `FilterChip(selected, onClick)`. SwiftUI: a horizontal `ScrollView` of
 * `Toggle(isOn:)` with `.toggleStyle(.button)`.
 */
export function QuickFilters({ params, onToggle, leading }: Readonly<QuickFiltersProps>) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const maxItemWidth = getFilterItemMaxWidth({
    windowWidth: width,
    horizontalInset: GRID_EDGE_PADDING + GRID_CELL_PADDING,
    minimumWidth: sizes.minimumTouchTarget,
  });

  return (
    <ScrollView
      accessibilityLabel={t('productList.filters.groupLabel')}
      contentContainerStyle={styles.row}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}>
      {leading?.map((item) => (
        <View key={item.key} style={{ maxWidth: maxItemWidth }}>
          {item.node}
        </View>
      ))}
      {QUICK_FILTER_KEYS.map((key) => (
        <FilterChip
          key={key}
          label={t(labelKeys[key])}
          maxWidth={maxItemWidth}
          onPress={() => onToggle(key)}
          selected={params[key]}
        />
      ))}
    </ScrollView>
  );
}

type FilterChipProps = {
  label: string;
  maxWidth: number;
  selected: boolean;
  onPress: () => void;
};

function FilterChip({ label, maxWidth, selected, onPress }: Readonly<FilterChipProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();

  return (
    <Pressable
      accessibilityHint={t(
        selected ? 'productList.filters.deselectHint' : 'productList.filters.selectHint',
      )}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        // A chip is never wider than the row: at a huge font its text wraps instead.
        { maxWidth },
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && !reduceMotion ? styles.pressed : null,
      ]}>
      <View style={styles.content}>
        {selected ? (
          <AppText
            accessibilityElementsHidden
            importantForAccessibility="no"
            tone="onPrimary"
            variant="label">
            ✓
          </AppText>
        ) : null}
        <AppText
          style={styles.label}
          tone={selected ? 'onPrimary' : 'default'}
          variant="label">
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: spacing.sm,
    // Room so the border of a chip is not cut by the scroll view.
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: sizes.minimumTouchTarget,
    minWidth: sizes.minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.72,
  },
});
