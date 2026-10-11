import { Platform, StyleSheet, Text, type ColorValue } from 'react-native';

import { fontScaleLimits } from '@/design-system';

type TabBarLabelProps = {
  color: ColorValue;
  position: 'below-icon' | 'beside-icon';
  children: string;
};

/**
 * Tab label with a bounded font scale. The default label of the navigator can only turn scaling on
 * or off (`tabBarAllowFontScaling` is a boolean), so a custom `tabBarLabel` is the supported way to
 * set `maxFontSizeMultiplier`. It mirrors the default look: 10 pt below the icon, 13 pt beside it,
 * one line. On iOS the navigator disables scaling on purpose (the system "large content viewer"
 * shows the full title on long press), so that behaviour is kept there.
 */
export function TabBarLabel({ color, position, children }: Readonly<TabBarLabelProps>) {
  return (
    <Text
      allowFontScaling={Platform.OS !== 'ios'}
      maxFontSizeMultiplier={fontScaleLimits.tabLabel}
      numberOfLines={1}
      style={[styles.label, position === 'beside-icon' ? styles.besideIcon : null, { color }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  besideIcon: {
    fontSize: 13,
    marginStart: 5,
  },
});
