import { useCallback, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { ReminderDetailModal } from '../src/components/ReminderDetailModal.js';
import { DoneToggle } from '../src/components/DoneToggle.js';
import { NoInternetView } from '../src/components/NoInternetView.js';
import { listReminders, completeReminder, deleteReminder, getErrorMessage } from '../src/api/index.js';
import { resyncLocalReminders } from '../src/utils/localReminders.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../src/theme.js';

const PAGE_SIZE = 30;
const FILTERS = ['All', 'Today', 'Upcoming', 'Completed'];

const CATEGORY_LABELS = {
  medicine: 'Medicine',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  task: 'Task',
  custom: 'Others',
  recharge: 'Recharge',
  event: 'Event',
  alarm: 'Alarm',
  company: 'Company',
  note: 'Message',
};

// Group/Task reminders carry their own hierarchy - worth a more specific
// label than the generic type-based one above.
const categoryLabel = (reminder) => {
  if (reminder.group_id) return 'Group';
  if (reminder.project_id) return 'Task';
  return CATEGORY_LABELS[reminder.type] || 'Reminder';
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// "Today" / "Tomorrow" / an absolute date - reminder_date is a plain
// "YYYY-MM-DD", parsed as a local calendar date (not through Date's
// UTC-ish string parsing) so it can't drift a day depending on the
// device's timezone offset, same trick ReminderDetailModal uses.
const formatDateLabel = (value) => {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.getTime() === today.getTime()) return 'Today';
  if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// reminder_time comes back as bare "HH:mm:ss" - anchored to an arbitrary
// date just to get a parseable Date object, same trick ReminderRow uses.
const formatTime = (value) => {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : `1970-01-01T${value}`);
  if (Number.isNaN(d.getTime())) return value;
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
};

export default function ReminderHistory() {
  const router = useRouter();
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // True only when the load below failed to reach the server at all (see
  // the catch) - see src/components/NoInternetView.js for why this is
  // tracked separately from a genuinely empty list.
  const [offline, setOffline] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
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
      setOffline(false);
    } catch (err) {
      setReminders([]);
      setHasMore(false);
      setOffline(!err?.response);
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
      resyncLocalReminders(user?.id);
    } catch {
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_completed: !next } : r)));
    }
  };

  const openReminder = (reminder) => setSelectedReminderId(reminder.id);

  const handleEdit = (reminder) => {
    setSelectedReminderId(null);
    if (reminder.group_id) {
      router.push(`/group-reminders/${reminder.id}`);
      return;
    }
    if (reminder.project_id) {
      router.push(`/tasks/${reminder.id}`);
      return;
    }
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
            resyncLocalReminders(user?.id);
          } catch (err) {
            setReminders(previous);
            Alert.alert('Could not delete reminder', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  // Search + tab filtering happen client-side over whatever's been paged in
  // so far - simplest option that needs no new backend filters, and fine at
  // personal-reminder scale (scrolling further still pages in more raw
  // items, which then get filtered the same way).
  const visibleReminders = reminders.filter((r) => {
    if (search.trim() && !r.title?.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (activeFilter === 'Today') return r.reminder_date === todayIso();
    if (activeFilter === 'Upcoming') return r.reminder_date > todayIso() && !r.is_completed;
    if (activeFilter === 'Completed') return !!r.is_completed;
    return true;
  });

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Reminders</Text>
        <Pressable
          onPress={() => {
            setShowSearch((s) => !s);
            setSearch('');
          }}
          hitSlop={12}
        >
          <Ionicons name={showSearch ? 'close' : 'search'} size={22} color={colors.text} />
        </Pressable>
      </View>

      {showSearch ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search reminders..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      ) : null}

      <View style={styles.tabRow}>
        {FILTERS.map((filter) => {
          const active = activeFilter === filter;
          return (
            <Pressable
              key={filter}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{filter}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={visibleReminders}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const typeStyle = reminderTypeStyles[item.type] || reminderTypeStyles.custom;
          return (
            <Pressable
              style={[styles.card, { borderLeftColor: typeStyle.color }]}
              onPress={() => openReminder(item)}
            >
              <View style={[styles.cardIconWrap, { backgroundColor: typeStyle.bg }]}>
                <MaterialCommunityIcons name={typeStyle.icon} size={20} color={typeStyle.color} />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTitle, item.is_completed && styles.cardTitleDone]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {formatDateLabel(item.reminder_date)}
                  {item.reminder_time ? `, ${formatTime(item.reminder_time)}` : ''}
                </Text>
                <Text style={styles.cardCategory}>{categoryLabel(item)}</Text>
              </View>
              <DoneToggle done={!!item.is_completed} onPress={() => handleToggle(item)} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            offline ? (
              <NoInternetView onRetry={load} />
            ) : (
              <Text style={styles.emptyText}>
                {search.trim() || activeFilter !== 'All' ? 'No reminders match.' : 'No reminders yet.'}
              </Text>
            )
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/reminders/add')} hitSlop={8}>
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.bodyMuted,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.white,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  cardTitleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  cardSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  cardCategory: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  footerLoader: {
    marginVertical: spacing.md,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
