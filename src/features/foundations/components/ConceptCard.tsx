import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppSurface, AppText, radii, spacing, useAppTheme } from '@/design-system';

type ConceptCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ConceptCard({ title, description, children }: Readonly<ConceptCardProps>) {
  const { colors } = useAppTheme();

  return (
    <AppSurface style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.header}>
        <AppText accessibilityRole="header" variant="subheading">
          {title}
        </AppText>
        {description ? <AppText tone="muted">{description}</AppText> : null}
      </View>
      {children}
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  header: {
    gap: spacing.xs,
  },
});
