import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { searchUsers } from '../api/index.js';
import { colors, radius, spacing, typography } from '../theme.js';

// Lets a reminder be shared with one or several other app users at once
// (e.g. a Company reminder sent to a colleague, or a whole group) - the
// backend fans the due-reminder push out to everyone selected here in
// addition to the reminder's own owner (see reminder_recipients).
export const RecipientPicker = ({ label = 'Send reminder to', value = [], onChange }) => {
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
        const users = await searchUsers(trimmed);
        setResults(users.filter((u) => !value.some((v) => v.id === u.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, value]);

  const addRecipient = (user) => {
    onChange([...value, user]);
    setQuery('');
    setResults([]);
  };

  const removeRecipient = (id) => onChange(value.filter((r) => r.id !== id));

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {value.length ? (
        <View style={styles.chipRow}>
          {value.map((r) => (
            <View key={r.id} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {r.name}
              </Text>
              <Pressable onPress={() => removeRecipient(r.id)} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

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
            <Pressable key={user.id} style={styles.resultRow} onPress={() => addRecipient(user)}>
              <Text style={styles.resultText}>{user.name}</Text>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.hint}>
        Everyone added here also gets a notification when this reminder is due - great for sharing a follow-up with a
        colleague or a whole group at once.
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    maxWidth: 180,
  },
  chipText: {
    ...typography.bodyMuted,
    color: colors.primaryDark,
    fontWeight: '600',
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
