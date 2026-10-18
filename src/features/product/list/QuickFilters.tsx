import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { useScrollReveal } from '@/core/layout/use-scroll-reveal';
import { AppText, fontScaleLimits, radii, sizes, spacing, useAppTheme } from '@/design-system';

import { getFilterItemMaxWidth } from '../logic/filter-bar-layout';
import { QUICK_FILTER_KEYS, type ListParams, type QuickFilterKey } from '../logic/list-params';
import { GRID_CELL_PADDING, GRID_EDGE_PADDING } from './grid-layout';

type QuickFiltersProps = {
  params: ListParams;
  onToggle: (key: QuickFilterKey) => void;
  /**
   * Shown before the chips (the sort button and the advanced-filters button), each with a stable
   * `key`. They form ONE group no wider than the row shows, whose items shrink and wrap their text
   * to fit side by side: both buttons are always inside the first viewport (G-4/S-8), and only the
   * chips after them scroll away. The caller caps the font scale of their labels with
   * `fontScaleLimits.filterBar`.
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
 * The bar is pinned above the list, so its text scales only up to `fontScaleLimits.filterBar`: a
 * pinned bar that grew with the system font would take a fifth of the screen at iOS AX5 and push
 * "Filters" off the edge. The two leading buttons sit in a group (`flexDirection: 'row'`, items with
 * `flexShrink`: 1 for the first, 0 for the others) whose own `maxWidth` is one viewport: the first item
 * shrinks and wraps between words to fit it, so neither can leave the screen and no word is split. In Compose that is a `Row` with `Modifier.weight(1f, fill = false)` items;
 * in SwiftUI an `HStack` with `.layoutPriority`.
 *
 * Compose: a `LazyRow` of `FilterChip(selected, onClick)`. SwiftUI: a horizontal `ScrollView` of
 * `Toggle(isOn:)` with `.toggleStyle(.button)`.
 */
export function QuickFilters({ params, onToggle, leading }: Readonly<QuickFiltersProps>) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const horizontalInset = GRID_EDGE_PADDING + GRID_CELL_PADDING;
  const maxItemWidth = getFilterItemMaxWidth({
    windowWidth: width,
    horizontalInset,
    minimumWidth: sizes.minimumTouchTarget,
  });
  // A chip that gets selected grows (it gains its check mark) and may end past the edge of the row it
  // was scrolled to: it is brought back into sight, keeping the gutter as margin.
  const { scrollRef, contentRef, onScroll, onLayout, reveal } = useScrollReveal(horizontalInset, 'horizontal');

  return (
    <ScrollView
      accessibilityLabel={t('productList.filters.groupLabel')}
      horizontal
      keyboardShouldPersistTaps="handled"
      onLayout={onLayout}
      onScroll={onScroll}
      ref={scrollRef}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      // Edge to edge, like Home's rows: the next chip peeks out of the gutter, which is the only hint that
      // the row scrolls once the two buttons take the whole line.
      style={{ marginHorizontal: -horizontalInset }}>
      <View ref={contentRef} style={[styles.row, { paddingHorizontal: horizontalInset }]}>
        {leading === undefined || leading.length === 0 ? null : (
          <View testID="quick-filters-leading" style={[styles.leading, { maxWidth: maxItemWidth }]}>
            {leading.map((item, index) => (
              <View key={item.key} style={index === 0 ? styles.leadingItemShrinks : styles.leadingItem}>
                {item.node}
              </View>
            ))}
          </View>
        )}
        {QUICK_FILTER_KEYS.map((key) => (
          <FilterChip
            key={key}
            label={t(labelKeys[key])}
            maxWidth={maxItemWidth}
            onPress={() => onToggle(key)}
            onReveal={reveal}
            selected={params[key]}
          />
        ))}
      </View>
    </ScrollView>
  );
}

type FilterChipProps = {
  label: string;
  maxWidth: number;
  selected: boolean;
  onPress: () => void;
  /** Asks the row to scroll this chip into sight; called once the chip that was just turned on is laid out. */
  onReveal: (chip: View | null) => void;
};

function FilterChip({ label, maxWidth, selected, onPress, onReveal }: Readonly<FilterChipProps>) {
  const { t } = useTranslation();
  const chipRef = useRef<View>(null);
  // Set when THIS chip is pressed to turn on: only the chip the person chose is brought into sight, not
  // the selected ones that merely moved because it grew.
  const revealWhenLaidOut = useRef(false);
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
      onLayout={() => {
        if (revealWhenLaidOut.current) {
          revealWhenLaidOut.current = false;
          onReveal(chipRef.current);
        }
      }}
      onPress={() => {
        revealWhenLaidOut.current = !selected;
        onPress();
      }}
      ref={chipRef}
      style={({ pressed }) => [
        styles.chip,
        // A chip is never wider than the row: at a huge font its text wraps instead.
        { maxWidth },
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.controlBorder,
        },
        pressed && !reduceMotion ? styles.pressed : null,
      ]}>
      <View style={styles.content}>
        {selected ? (
          <AppText
            accessibilityElementsHidden
            importantForAccessibility="no"
            maxFontSizeMultiplier={fontScaleLimits.filterBar}
            tone="onPrimary"
            variant="label">
            ✓
          </AppText>
        ) : null}
        <AppText
          maxFontSizeMultiplier={fontScaleLimits.filterBar}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Room so the border of a chip is not cut by the scroll view.
    paddingVertical: spacing.xs,
  },
  leading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Only the first item (the sort button, whose text changes with the option) gives width back. Yoga
  // shrinks siblings in proportion to their size, so a short second item ("Filtros") lost enough width to
  // be split in the middle of the word at iOS AX5; a word never wraps, so it keeps its own width.
  leadingItemShrinks: {
    flexShrink: 1,
  },
  leadingItem: {
    flexShrink: 0,
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
