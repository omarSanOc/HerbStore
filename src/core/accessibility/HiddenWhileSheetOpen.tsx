import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

import { modalSheetRegistry } from './modal-sheet-registry';

const serverSnapshot = () => false;

/**
 * Wraps the app and hides it from screen readers while any modal sheet is open (see
 * `modal-sheet-registry.ts`). The sheets live OUTSIDE this wrapper (Gorhom renders them in a portal
 * host that is a sibling), so they stay reachable.
 *
 * - Android: `importantForAccessibility="no-hide-descendants"` removes the subtree from TalkBack.
 * - iOS: `accessibilityElementsHidden` does the same for VoiceOver.
 * Both props exist on both platforms and the other platform ignores them.
 */
export function HiddenWhileSheetOpen({ children }: Readonly<{ children: ReactNode }>) {
  const hidden = useSyncExternalStore(
    modalSheetRegistry.subscribe,
    modalSheetRegistry.isAnyOpen,
    serverSnapshot,
  );

  return (
    <View
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={styles.fill}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
