import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing } from '../theme/tokens';

interface TimelineDotProps {
  icon: string;
  label: string;
  detail?: string;
  completed?: boolean;
  active?: boolean;
  isLast?: boolean;
}

/** A single step in the delivery timeline (Active SOS screen). */
export function TimelineDot({ icon, label, detail, completed = false, active = false, isLast = false }: TimelineDotProps) {
  const dotColor = completed
    ? colors.accent.success
    : active
      ? colors.accent.warning
      : colors.text.muted;

  return (
    <View style={styles.container}>
      <View style={styles.iconColumn}>
        <View style={[styles.dot, { backgroundColor: dotColor }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        {!isLast && <View style={[styles.line, { backgroundColor: completed ? colors.accent.success : colors.border.default }]} />}
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, completed && styles.labelCompleted, active && styles.labelActive]}>
          {label}
        </Text>
        {detail && (
          <Text style={styles.detail}>{detail}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    minHeight: 48,
  },
  iconColumn: {
    alignItems: 'center',
    width: 32,
    marginRight: spacing.md,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 14,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 16,
  },
  content: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  label: {
    color: colors.text.muted,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  labelCompleted: {
    color: colors.accent.success,
  },
  labelActive: {
    color: colors.accent.warning,
  },
  detail: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
});
