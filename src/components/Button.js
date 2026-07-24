import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, spacing, typography } from '../theme.js';

export const Button = ({ title, onPress, variant = 'primary', loading, disabled, style }) => {
  const isOutline = variant === 'outline';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isOutline ? styles.outline : styles.primary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.primary : colors.white} />
      ) : (
        <Text style={[typography.button, isOutline && styles.outlineText]}>{title}</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlineText: {
    color: colors.text,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
