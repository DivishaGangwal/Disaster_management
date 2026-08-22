import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing } from '../theme/tokens';

interface InfoRowProps {
  label: string;
  value: string;
  valueColor?: string;
  /** Show a small colored dot before the value */
  dotColor?: string;
}

/** Label + value row for displaying key-value information. */
export function InfoRow({ label, value, valueColor = colors.text.primary, dotColor }: InfoRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueContainer}>
        {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
        <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    flex: 1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  value: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    textAlign: 'right',
  },
});
