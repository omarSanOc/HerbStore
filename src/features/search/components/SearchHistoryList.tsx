import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import {
  AppButton,
  AppIcon,
  AppText,
  fontScaleLimits,
  sizes,
  spacing,
  useAppTheme,
} from '@/design-system';

import type { SearchHistory } from '../logic/search-history';

type SearchHistoryListProps = {
  entries: SearchHistory;
  /** Run this entry (it is sent as a search). */
  onSelect: (text: string) => void;
  onRemove: (text: string) => void;
  onClear: () => void;
};

/**
 * Recent searches (RF-18): run one, remove one or clear all, each with an immediate effect.
 *
 * - A row is two targets side by side: the text (runs the search, `flex: 1`, wraps when the font
 *   grows) and a 48x48 remove button whose spoken label carries the entry's own text.
 * - "Clear all" is in the heading row, which wraps below the title with a large font instead of
 *   cutting the button; there is no confirmation because the spec asks for an immediate effect.
 * - Plain `ScrollView`: at most 10 rows (`MAX_SEARCH_HISTORY`), so a virtualized list would add
 *   cost and no benefit. `keyboardShouldPersistTaps="handled"` lets a tap on a row work with the
 *   keyboard open, and `keyboardDismissMode="on-drag"` closes the keyboard when the user scrolls.
 *
 * Compose: a `LazyColumn` of `ListItem`s with a trailing `IconButton`; SwiftUI: a `List` with
 * `Button` rows and `.swipeActions` (here the remove button is always visible instead of a swipe,
 * because a hidden gesture is much harder to reach with a screen reader).
 */
export function SearchHistoryList({
  entries,
  onSelect,
  onRemove,
  onClear,
}: Readonly<SearchHistoryListProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled">
      <View style={styles.headingRow}>
        <AppText
          accessibilityRole="header"
          maxFontSizeMultiplier={fontScaleLimits.sectionHeading}
          style={styles.heading}
          variant="subheading">
          {t('search.history.title')}
        </AppText>
        {entries.length === 0 ? null : (
          <AppButton
            accessibilityHint={t('search.history.clearAllHint')}
            label={t('search.history.clearAll')}
            maxFontSizeMultiplier={fontScaleLimits.actionLabel}
            onPress={onClear}
          />
        )}
      </View>
      {entries.length === 0 ? (
        <AppText tone="muted">{t('search.history.empty')}</AppText>
      ) : (
        entries.map((entry) => (
          <View key={entry} style={styles.row}>
            <Pressable
              accessibilityHint={t('search.history.runHint')}
              accessibilityRole="button"
              onPress={() => onSelect(entry)}
              style={({ pressed }) => [
                styles.run,
                pressed && !reduceMotion ? styles.pressed : null,
              ]}>
              <AppIcon
                name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
                size={22}
                color={colors.textMuted}
              />
              {/* `flex: 1` + `minWidth: 0`: a long search wraps by words instead of leaving the row. */}
              <AppText maxFontSizeMultiplier={fontScaleLimits.optionLabel} style={styles.entryText}>
                {entry}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityHint={t('search.history.removeHint')}
              accessibilityLabel={t('search.history.removeLabel', { text: entry })}
              accessibilityRole="button"
              onPress={() => onRemove(entry)}
              style={({ pressed }) => [
                styles.remove,
                pressed && !reduceMotion ? styles.pressed : null,
              ]}>
              <AppIcon
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  heading: {
    flexShrink: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  run: {
    flex: 1,
    minWidth: 0,
    minHeight: sizes.minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  entryText: {
    flex: 1,
    minWidth: 0,
  },
  remove: {
    width: sizes.minimumTouchTarget,
    minHeight: sizes.minimumTouchTarget,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
