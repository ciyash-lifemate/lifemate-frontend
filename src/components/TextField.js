import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../theme.js';
import { VoiceMicButton } from './VoiceMicButton.js';

export const TextField = ({ label, style, containerStyle, prefix, voiceInput, ...inputProps }) => (
  <View style={[styles.container, containerStyle]}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <View style={styles.inputRow}>
      {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textMuted}
        {...inputProps}
      />
      {inputProps.value ? (
        <Pressable onPress={() => inputProps.onChangeText?.('')} hitSlop={10} style={styles.clearBtn}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {voiceInput ? (
        <VoiceMicButton value={inputProps.value} onChangeText={inputProps.onChangeText} style={styles.micBtn} />
      ) : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyMuted,
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  prefix: {
    ...typography.body,
    marginRight: spacing.xs,
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    height: 52,
    ...typography.body,
  },
  clearBtn: {
    marginLeft: spacing.xs,
  },
  micBtn: {
    marginLeft: spacing.xs,
  },
});
