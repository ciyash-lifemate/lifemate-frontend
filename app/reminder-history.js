import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { ReminderRow } from '../src/components/ReminderRow.js';
import { listReminders, completeReminder, deleteReminder } from '../src/api/index.js';
import { colors, spacing, typography } from '../src/theme.js';

export default function ReminderHistory() {
  const router = useRouter();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await listReminders();
      setReminders(Array.isArray(data) ? data : []);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleToggle = async (reminder) => {
    const next = !reminder.is_completed;
    setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_completed: next } : r)));
    try {
      await completeReminder(reminder.id, next);
    } catch {
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_completed: !next } : r)));
    }
  };

  const openReminder = (reminder) => {
    router.push({ pathname: `/reminders/${reminder.type}`, params: { id: reminder.id } });
  };

  const handleDelete = (reminder) => {
    Alert.alert('Delete reminder', `Delete "${reminder.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const previous = reminders;
          setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
          try {
            await deleteReminder(reminder.id);
          } catch (err) {
            setReminders(previous);
            Alert.alert('Could not delete reminder', err.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Reminder History</Text>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        data={reminders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ReminderRow reminder={item} onToggle={handleToggle} onPress={openReminder} onDelete={handleDelete} />
        )}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No reminders yet.</Text> : null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
