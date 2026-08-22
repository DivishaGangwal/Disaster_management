import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fontSize, spacing, radius } from '../theme/tokens';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  /** Fill the full width */
  fullWidth?: boolean;
  /** Extra large (for the SOS button) */
  large?: boolean;
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  large = false,
}: ActionButtonProps) {
  const bgColor = disabled
    ? colors.bg.elevated
    : variant === 'primary'
      ? colors.accent.info
      : variant === 'danger'
        ? colors.accent.emergency
        : variant === 'secondary'
          ? colors.bg.elevated
          : 'transparent';

  const textColor = disabled
    ? colors.text.muted
    : variant === 'ghost'
      ? colors.accent.info
      : variant === 'secondary'
        ? colors.text.primary
        : '#FFFFFF';

  const borderColor = variant === 'ghost' ? colors.border.active : variant === 'secondary' ? colors.border.default : 'transparent';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bgColor, borderColor },
        fullWidth && styles.fullWidth,
        large && styles.large,
        variant === 'ghost' && styles.ghost,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColor }, large && styles.largeLabel]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 44,
  },
  fullWidth: {
    width: '100%',
  },
  large: {
    paddingVertical: spacing.xl,
    borderRadius: radius.xl,
    minHeight: 64,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  largeLabel: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
});
