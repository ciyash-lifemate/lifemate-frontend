import { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { ReminderRow } from '../src/components/ReminderRow.js';
import { ReminderDetailModal } from '../src/components/ReminderDetailModal.js';
import { listReminders, completeReminder, deleteReminder, getErrorMessage } from '../src/api/index.js';
import { colors, spacing, typography } from '../src/theme.js';

const PAGE_SIZE = 30;

export default function ReminderHistory() {
  const router = useRouter();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // An id, not the reminder object itself, so toggling "done" from inside
  // the modal re-derives the live row below instead of showing a stale snapshot.
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const selectedReminder = reminders.find((r) => r.id === selectedReminderId) || null;
  const pageRef = useRef(1);

  const load = useCallback(async () => {
    pageRef.current = 1;
    setLoading(true);
    try {
      const data = await listReminders({ page: 1, pageSize: PAGE_SIZE });
      const items = Array.isArray(data) ? data : data?.items || [];
      setReminders(items);
      setHasMore(Array.isArray(data) ? false : items.length < (data?.total ?? items.length));
    } catch {
      setReminders([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const data = await listReminders({ page: nextPage, pageSize: PAGE_SIZE });
      const items = Array.isArray(data) ? data : data?.items || [];
      if (items.length) {
        pageRef.current = nextPage;
        setReminders((prev) => [...prev, ...items]);
      }
      const total = Array.isArray(data) ? null : data?.total;
      setHasMore(total != null ? pageRef.current * PAGE_SIZE < total : items.length === PAGE_SIZE);
    } catch {
      // Leave hasMore as-is - a transient failure shouldn't stop future scroll attempts.
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore]);

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

  const openReminder = (reminder) => setSelectedReminderId(reminder.id);

  const handleEdit = (reminder) => {
    setSelectedReminderId(null);
    router.push({ pathname: `/reminders/${reminder.type}`, params: { id: reminder.id } });
  };

  const handleDelete = (reminder) => {
    Alert.alert('Delete reminder', `Delete "${reminder.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSelectedReminderId(null);
          const previous = reminders;
          setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
          try {
            await deleteReminder(reminder.id);
          } catch (err) {
            setReminders(previous);
            Alert.alert('Could not delete reminder', getErrorMessage(err));
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
          <ReminderRow
            reminder={item}
            onToggle={handleToggle}
            onPress={openReminder}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No reminders yet.</Text> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
      />
      <ReminderDetailModal
        visible={!!selectedReminder}
        reminder={selectedReminder}
        onClose={() => setSelectedReminderId(null)}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onDelete={handleDelete}
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
  footerLoader: {
    marginVertical: spacing.md,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
