import type { Ref } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTextRemeasureKey } from '@/core/accessibility/use-text-remeasure-key';
import { typography } from '@/design-system/tokens';
import { useAppTheme } from '@/design-system/theme';

type AppTextVariant = keyof typeof typography;

type AppTextProps = TextProps & {
  /** React 19: `ref` is a plain prop. Used to move the screen-reader focus to a title. */
  ref?: Ref<Text>;
  tone?: 'default' | 'muted' | 'onPrimary';
  variant?: AppTextVariant;
};

/**
 * The text of the whole app. H-10 (= N-4): on iOS, a text size changed in Settings while the app is
 * open would leave each `Text` in the box it measured at the old size (React Native updates its
 * layout context but never marks the text nodes dirty), cutting the larger glyphs. The font scale is
 * the `key` of the `Text`, so a new size remounts it and it is measured again; its parents and their
 * state are untouched. Android relaunches the Activity on that change, so it has no key there.
 */
export function AppText({
  allowFontScaling = true,
  style,
  tone = 'default',
  variant = 'body',
  ...props
}: Readonly<AppTextProps>) {
  const { colors } = useAppTheme();
  const remeasureKey = useTextRemeasureKey();
  const toneColors: Record<NonNullable<AppTextProps['tone']>, string> = {
    default: colors.text,
    muted: colors.textMuted,
    onPrimary: colors.onPrimary,
  };

  return (
    <Text
      key={remeasureKey}
      allowFontScaling={allowFontScaling}
      style={[typography[variant] as TextStyle, { color: toneColors[tone] }, style]}
      {...props}
    />
  );
}
