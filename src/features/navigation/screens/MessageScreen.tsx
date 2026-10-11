import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppSurface, AppText, spacing } from '@/design-system';

type MessageScreenProps = {
  title: string;
  message?: string;
  children?: ReactNode;
};

/**
 * Full-screen state message (loading, not found, error) with optional actions below.
 * Scrolls so the text can grow with the system font scale without clipping the actions.
 */
export function MessageScreen({ title, message, children }: Readonly<MessageScreenProps>) {
  return (
    <AppSurface level="page" style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <AppText accessibilityRole="header" variant="subheading">
          {title}
        </AppText>
        {message === undefined ? null : <AppText tone="muted">{message}</AppText>}
        {children}
      </ScrollView>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
  },
});
