import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { searchUsers } from '../api/index.js';
import { colors, radius, spacing, typography } from '../theme.js';

// Single-assignee variant of RecipientPicker - a Task has at most one
// person it's delegated to, so this replaces the selection on a new pick
// instead of appending to a list, and shows the current pick as a single
// card (with a way to clear it) rather than a row of chips.
export const AssigneePicker = ({ label = 'Assign to', value, onChange }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchUsers(trimmed));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const pick = (user) => {
    onChange(user);
    setQuery('');
    setResults([]);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {value ? (
        <View style={styles.selectedRow}>
          <Text style={styles.selectedText} numberOfLines={1}>
            {value.name}
          </Text>
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.field}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Search people by name"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
            {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>

          {results.length ? (
            <View style={styles.results}>
              {results.map((user) => (
                <Pressable key={user.id} style={styles.resultRow} onPress={() => pick(user)}>
                  <Text style={styles.resultText}>{user.name}</Text>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}

      <Text style={styles.hint}>
        {value
          ? 'This task will appear in their own reminders and notify them - one tap to pick someone else.'
          : 'If they use the app, they get this task in their own reminders and get notified.'}
      </Text>
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
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  selectedText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
  },
  results: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultText: {
    ...typography.body,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
