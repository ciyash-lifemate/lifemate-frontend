import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DoneToggle } from './DoneToggle.js';
import { colors, radius, spacing, typography } from '../theme.js';

// A dynamic list of {text, done} rows with a trailing "+ Add Item" control -
// the agenda/todo checklist on an Event/Meeting reminder. Kept generic (not
// wired to any particular reminder type) so any form can drop it in.
export const ChecklistEditor = ({ label = 'Checklist', items, onChange }) => {
  const updateItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, { text: '', done: false }]);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {items.map((item, index) => (
        <View key={index} style={styles.row}>
          <DoneToggle done={item.done} onPress={() => updateItem(index, { done: !item.done })} size={22} />
          <TextInput
            style={[styles.input, item.done && styles.inputDone]}
            placeholder={`Item ${index + 1}`}
            placeholderTextColor={colors.textMuted}
            value={item.text}
            onChangeText={(text) => updateItem(index, { text })}
          />
          <Pressable hitSlop={10} onPress={() => removeItem(index)}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      <Pressable style={styles.addRow} onPress={addItem}>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.addLabel}>Add Item</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyMuted,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    ...typography.body,
  },
  inputDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  addLabel: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});
