import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAppSelector } from '@/core/store/hooks';
import { useAppTheme } from '@/design-system';
import { getCartBadge } from '@/features/cart/format-cart-badge';
import { selectCartUnits } from '@/features/cart/logic/cart-selectors';
import { TabBarLabel } from '@/features/navigation/components/TabBarLabel';
import { TabBarSymbol } from '@/features/navigation/components/TabBarSymbol';
import { getTabBarBadgeStyle } from '@/features/navigation/tab-bar-badge';

// Any deep link into a tab starts from Home, the first tab, instead of an arbitrary one.
export const unstable_settings = {
  anchor: '(home)',
};

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  // The real cart: units across all lines, derived from the persisted slice.
  const cartCount = useAppSelector(selectCartUnits);

  return (
    <Tabs
      screenOptions={{
        // Each tab owns a Stack whose header is the visible title bar.
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        // Fixed-height bar: labels scale only up to `fontScaleLimits.tabLabel`.
        tabBarLabel: (props) => <TabBarLabel {...props} />,
        // Only the badge reads this: the custom label above ignores it. The built-in badge sits in a
        // fixed-height pill and cannot cap its scale, so it keeps its size (see `tab-bar-badge.ts`).
        tabBarAllowFontScaling: false,
        tabBarBadgeStyle: getTabBarBadgeStyle(colors),
      }}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: t('tabs.home'),
          tabBarAccessibilityLabel: t('tabs.home'),
          tabBarIcon: ({ color }) => <TabBarSymbol color={color} kind="home" />,
        }}
      />
      <Tabs.Screen
        name="(cart)"
        options={{
          title: t('tabs.cart'),
          // `undefined` hides the badge; 0 would render a visible "0".
          tabBarBadge: getCartBadge(cartCount),
          // Spoken label keeps the real count (100 -> "100 artículos"), not the capped badge text.
          tabBarAccessibilityLabel:
            cartCount > 0 ? t('tabs.cartLabel', { count: cartCount }) : t('tabs.cart'),
          tabBarIcon: ({ color }) => <TabBarSymbol color={color} kind="cart" />,
        }}
      />
      <Tabs.Screen
        name="(account)"
        options={{
          title: t('tabs.account'),
          tabBarAccessibilityLabel: t('tabs.account'),
          tabBarIcon: ({ color }) => <TabBarSymbol color={color} kind="account" />,
        }}
      />
    </Tabs>
  );
}
