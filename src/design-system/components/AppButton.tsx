import type { Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type View,
} from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText } from '@/design-system/components/AppText';
import { radii, sizes, spacing } from '@/design-system/tokens';
import { useAppTheme } from '@/design-system/theme';

type AppButtonProps = Omit<PressableProps, 'accessibilityLabel' | 'children'> & {
  /**
   * The button's own view. A sheet it opens uses it to give the screen-reader focus back to the
   * button when it closes (`AppBottomSheet.returnFocusTo`).
   */
  ref?: Ref<View>;
  accessibilityHint: string;
  /** What is drawn. It is also what a screen reader says, unless `accessibilityLabel` is given. */
  label: string;
  /** For when the spoken text must say more than the drawn one ("Filters, 2 active" for "Filters (2)"). */
  accessibilityLabel?: string;
  /** A state of the control ("selected" is announced). Filled when on. */
  selected?: boolean;
  /**
   * `primary` is the main action of a group (Apply): filled like a selected button but WITHOUT
   * the "selected" state, which would be announced and is not true of an action.
   */
  variant?: 'default' | 'primary';
  /** Upper bound for the system font scale of the label (`fontScaleLimits`); none by default. */
  maxFontSizeMultiplier?: number;
  /** Optional label layout override for a context with different text-flow constraints. */
  labelStyle?: StyleProp<TextStyle>;
};

export function AppButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  labelStyle,
  maxFontSizeMultiplier,
  selected = false,
  style,
  variant = 'default',
  ...props
}: Readonly<AppButtonProps>) {
  const reduceMotionEnabled = useReducedMotionPreference();
  const { colors } = useAppTheme();
  const isDisabled = disabled === true;
  const filled = selected || variant === 'primary';

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, selected }}
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        {
          backgroundColor: filled ? colors.primary : colors.surface,
          borderColor: filled ? colors.primary : colors.controlBorder,
        },
        state.pressed && !reduceMotionEnabled ? styles.pressed : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      <AppText
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        style={[styles.label, labelStyle]}
        tone={filled ? 'onPrimary' : 'default'}
        variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: sizes.minimumTouchTarget,
    minWidth: sizes.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  // A label that wraps (a capped width at a large font) stays centered line by line.
  label: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
