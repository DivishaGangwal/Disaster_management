import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, radius } from '../theme/tokens';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
}

/** Dark card container for grouping related content. */
export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
});
