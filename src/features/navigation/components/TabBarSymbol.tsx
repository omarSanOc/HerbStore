import type { ColorValue } from 'react-native';

import { AppIcon } from '@/design-system';

export type TabKind = 'home' | 'cart' | 'account';

/**
 * Same concept, two icon sets: SF Symbols on iOS and Material Symbols on Android.
 * `SymbolView` picks the entry for the running platform and renders nothing visible
 * (the tab keeps its text label) if a platform name is missing.
 */
const symbols = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  cart: { ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' },
  account: { ios: 'person.fill', android: 'person', web: 'person' },
} as const;

type TabBarSymbolProps = {
  kind: TabKind;
  color: ColorValue;
  size?: number;
};

export function TabBarSymbol({ kind, color, size = 26 }: Readonly<TabBarSymbolProps>) {
  return (
    <AppIcon
      name={symbols[kind]}
      size={size}
      color={color}
    />
  );
}
