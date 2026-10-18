import { StyleSheet, View } from 'react-native';

import { AppButton, AppSurface, AppText, radii, spacing } from '@/design-system';

type Option<Value extends string> = Readonly<{ value: Value; label: string; hint: string }>;

type PreferenceChoiceCardProps<Value extends string> = Readonly<{
  heading: string;
  description: string;
  options: readonly Option<Value>[];
  selected: Value;
  onSelect: (value: Value) => void;
}>;

/**
 * One single-choice preference: a heading, a sentence and one `AppButton` per option. The selected
 * one is filled and announced as "selected" (the same control and pattern as the language buttons
 * of Fundamentals and the currency selector of Day 4). Buttons wrap to a new row with large text
 * and keep the 44/48 target of `AppButton`.
 *
 * Compose: a `SingleChoiceSegmentedButtonRow`; SwiftUI: a `Picker` with `.segmented` style.
 */
export function PreferenceChoiceCard<Value extends string>({
  heading,
  description,
  options,
  selected,
  onSelect,
}: PreferenceChoiceCardProps<Value>) {
  return (
    <AppSurface style={styles.card}>
      <AppText accessibilityRole="header" variant="subheading">
        {heading}
      </AppText>
      <AppText tone="muted">{description}</AppText>
      <View style={styles.row}>
        {options.map((option) => (
          <AppButton
            accessibilityHint={option.hint}
            key={option.value}
            label={option.label}
            onPress={() => onSelect(option.value)}
            selected={selected === option.value}
          />
        ))}
      </View>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
