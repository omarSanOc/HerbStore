import type { Ref } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { typography } from '@/design-system/tokens';
import { useAppTheme } from '@/design-system/theme';

type AppTextVariant = keyof typeof typography;

type AppTextProps = TextProps & {
  /** React 19: `ref` is a plain prop. Used to move the screen-reader focus to a title. */
  ref?: Ref<Text>;
  tone?: 'default' | 'muted' | 'onPrimary';
  variant?: AppTextVariant;
};

export function AppText({
  allowFontScaling = true,
  style,
  tone = 'default',
  variant = 'body',
  ...props
}: Readonly<AppTextProps>) {
  const { colors } = useAppTheme();
  const toneColors: Record<NonNullable<AppTextProps['tone']>, string> = {
    default: colors.text,
    muted: colors.textMuted,
    onPrimary: colors.onPrimary,
  };

  return (
    <Text
      allowFontScaling={allowFontScaling}
      style={[typography[variant] as TextStyle, { color: toneColors[tone] }, style]}
      {...props}
    />
  );
}
