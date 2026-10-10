import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppText } from '@/design-system/components/AppText';
import { radii, sizes, spacing } from '@/design-system/tokens';
import { useAppTheme } from '@/design-system/theme';

type AppButtonProps = Omit<PressableProps, 'accessibilityLabel' | 'children'> & {
  accessibilityHint: string;
  label: string;
  selected?: boolean;
};

export function AppButton({
  accessibilityHint,
  disabled = false,
  label,
  selected = false,
  style,
  ...props
}: Readonly<AppButtonProps>) {
  const reduceMotionEnabled = useReducedMotionPreference();
  const { colors } = useAppTheme();
  const isDisabled = disabled === true;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, selected }}
      disabled={isDisabled}
      style={(state) => [
        styles.button,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        state.pressed && !reduceMotionEnabled ? styles.pressed : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      <AppText tone={selected ? 'onPrimary' : 'default'} variant="label">
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
  pressed: {
    opacity: 0.72,
  },
});
