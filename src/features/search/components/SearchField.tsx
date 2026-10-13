import type { Ref } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import {
  AppIcon,
  AppText,
  fontScaleLimits,
  radii,
  sizes,
  spacing,
  useAppTheme,
} from '@/design-system';

/** Longest text the field accepts: well above any product or brand name, far below a URL limit. */
const MAX_SEARCH_LENGTH = 100;

type SearchFieldProps = {
  /** React 19: `ref` is a plain prop. The screen uses it to give the focus back after "clear". */
  ref?: Ref<TextInput>;
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Return / search key of the keyboard: the search is SENT. It receives the text of the submit
   * EVENT, not the one of the last render (S-2): see `resolveSubmittedText`.
   */
  onSubmit: (submittedText: string) => void;
  onClear: () => void;
};

/**
 * The text field of the search screen, drawn in the CONTENT (not `headerSearchBarOptions`, the
 * native header search bar: see the decision in the plan). It is a controlled `TextInput` plus a
 * clear button that only exists while there is text.
 *
 * - `returnKeyType="search"` labels the keyboard key; `onSubmitEditing` sends the search.
 * - Accessible name (S-7): the field is "Buscar productos" (`accessibilityLabel`) with the help as
 *   hint. On Android a `TextInput` with a native `placeholder` exposes it as the node TEXT while
 *   the field is empty (the `AccessibilityNodeInfo` `getText()` falls back to the hint) and TalkBack
 *   reads the text before the `contentDescription`, so the label was never spoken. Android
 *   therefore draws the placeholder itself (`AppText`, hidden from the screen reader, taps go
 *   through it) and leaves the native one empty; iOS keeps the native placeholder because
 *   VoiceOver already speaks label + value + hint there.
 * - The clear button is a 48x48 target (the native `clearButtonMode` is iOS only and tiny).
 * - Font scaling is capped like Home's search field (`fontScaleLimits.searchField`): the field
 *   grows to fit the text, it never clips, and `minHeight` keeps the target at 48.
 * - Dark theme: placeholder and text come from the theme and the keyboard follows the scheme.
 *
 * Compose: `OutlinedTextField`/`SearchBar` with `KeyboardOptions(imeAction = ImeAction.Search)` and
 * `KeyboardActions(onSearch = ...)`; SwiftUI: `TextField` + `.submitLabel(.search)` + `.onSubmit`
 * (or `.searchable`, which is the native bar we did not choose).
 */
export function SearchField({
  ref,
  value,
  onChangeText,
  onSubmit,
  onClear,
}: Readonly<SearchFieldProps>) {
  const { t } = useTranslation();
  const { colors, scheme } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();
  const placeholder = t('search.field.placeholder');
  // Real platform difference (see the S-7 note above), the only one in this component.
  const drawsOwnPlaceholder = Platform.OS === 'android';

  const submit = (event: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    onSubmit(event.nativeEvent.text);
  };

  return (
    <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppIcon
        name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
        size={22}
        color={colors.textMuted}
      />
      <View style={[styles.inputBox, value === '' ? styles.inputAlone : null]}>
        <TextInput
          ref={ref}
          accessibilityHint={t('search.field.hint')}
          accessibilityLabel={t('search.field.label')}
          accessibilityRole="search"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
          maxFontSizeMultiplier={fontScaleLimits.searchField}
          maxLength={MAX_SEARCH_LENGTH}
          onChangeText={onChangeText}
          onSubmitEditing={submit}
          placeholder={drawsOwnPlaceholder ? undefined : placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          selectionColor={colors.primary}
          style={[styles.input, { color: colors.text }]}
          value={value}
        />
        {drawsOwnPlaceholder && value === '' ? (
          <View pointerEvents="none" style={styles.drawnPlaceholder}>
            <AppText
              accessibilityElementsHidden
              importantForAccessibility="no"
              maxFontSizeMultiplier={fontScaleLimits.searchField}
              numberOfLines={1}
              style={styles.drawnPlaceholderText}
              tone="muted">
              {placeholder}
            </AppText>
          </View>
        ) : null}
      </View>
      {value === '' ? null : (
        <Pressable
          accessibilityHint={t('search.field.clearHint')}
          accessibilityLabel={t('search.field.clear')}
          accessibilityRole="button"
          onPress={onClear}
          style={({ pressed }) => [styles.clear, pressed && !reduceMotion ? styles.pressed : null]}>
          <AppIcon
            name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.minimumTouchTarget,
    paddingLeft: spacing.md,
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  // `minWidth: 0` lets a long text shrink inside the row instead of pushing the clear button out.
  inputBox: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  input: {
    minHeight: sizes.minimumTouchTarget,
    paddingVertical: spacing.sm,
    paddingHorizontal: 0,
    fontSize: 16,
  },
  // Android only: the drawn placeholder sits exactly over the (empty) native text area.
  drawnPlaceholder: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
  },
  drawnPlaceholderText: {
    fontSize: 16,
    lineHeight: 22,
  },
  // Without the clear button the text would touch the rounded border.
  inputAlone: {
    marginRight: spacing.md,
  },
  clear: {
    minWidth: sizes.minimumTouchTarget,
    minHeight: sizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
