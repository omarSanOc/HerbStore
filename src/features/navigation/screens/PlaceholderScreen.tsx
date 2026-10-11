import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppSurface, AppText, spacing } from '@/design-system';

type PlaceholderScreenProps = {
  body: string;
  children?: ReactNode;
};

/**
 * Explicit destination for a tab whose real content arrives on a later day.
 * The stack header already shows the title, so the screen only renders the body.
 */
export function PlaceholderScreen({ body, children }: Readonly<PlaceholderScreenProps>) {
  return (
    <AppSurface level="page" style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <AppText tone="muted">{body}</AppText>
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
