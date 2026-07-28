import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { BottomNavBar } from '../src/components/BottomNavBar.js';
import { ReminderRow } from '../src/components/ReminderRow.js';
import { ReminderDetailModal } from '../src/components/ReminderDetailModal.js';
import { Avatar } from '../src/components/Avatar.js';
import {
  listTodayReminders,
  completeReminder,
  deleteReminder,
  getUnreadNotificationCount,
  getErrorMessage,
} from '../src/api/index.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../src/theme.js';

const QUICK_ADD = [
  { key: 'medicine', label: 'Medicine', path: '/reminders/medicine' },
  { key: 'birthday', label: 'Birthday', path: '/reminders/birthday' },
  { key: 'note', label: 'Note', path: '/notes' },
  { key: 'event', label: 'Event/Meeting', path: '/reminders/event' },
  { key: 'alarm', label: 'Alarm', path: '/reminders/alarm' },
  { key: 'custom', label: 'Others', path: '/reminders/custom' },
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // An id, not the reminder object itself, so toggling "done" from inside
  // the modal re-derives the live row below instead of showing a stale snapshot.
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const selectedReminder = reminders.find((r) => r.id === selectedReminderId) || null;

  const load = useCallback(async () => {
    try {
      const [todayReminders, unreadCount] = await Promise.all([
        listTodayReminders().catch(() => []),
        getUnreadNotificationCount().catch(() => 0),
      ]);
      setReminders(Array.isArray(todayReminders) ? todayReminders : todayReminders?.items || []);
      setUnread(typeof unreadCount === 'number' ? unreadCount : unreadCount?.count || 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleToggle = async (reminder) => {
    const next = !reminder.is_completed;
    setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_completed: next } : r)));
    try {
      await completeReminder(reminder.id, next);
    } catch {
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_completed: !next } : r)));
    }
  };

  const completedCount = reminders.filter((r) => r.is_completed).length;
  const pendingCount = reminders.length - completedCount;

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
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.identity} onPress={() => router.push('/profile')}>
            <Avatar name={user?.name} uri={user?.avatar_url} size={44} />
            <View style={styles.identityText}>
              <Text style={styles.greeting}>{greeting()}</Text>
              <Text style={styles.name}>{user?.name?.split(' ')[0] || 'there'} 👋</Text>
            </View>
          </Pressable>
          <Pressable style={styles.bell} onPress={() => router.push('/notifications')} hitSlop={10}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread > 0 ? <View style={styles.badge} /> : null}
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/ai-chat')} style={styles.aiCardWrap}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.aiCard}>
            <View style={styles.aiIconWrap}>
              <MaterialCommunityIcons name="robot-happy-outline" size={26} color={colors.white} />
            </View>
            <View style={styles.aiTextWrap}>
              <Text style={styles.aiTitle}>LifeMate AI</Text>
              <Text style={styles.aiSubtitle}>
                {reminders.length > 0
                  ? `You have ${reminders.length} reminder${reminders.length === 1 ? '' : 's'} today.`
                  : 'You are all caught up today.'}{'\n'}Stay productive 💪
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </Pressable>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Today's Reminders</Text>
            {reminders.length > 0 ? (
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{completedCount} done</Text>
                <View style={[styles.statusDot, styles.statusDotPending]} />
                <Text style={styles.statusText}>{pendingCount} pending</Text>
              </View>
            ) : null}
          </View>
          <Pressable onPress={() => router.push('/calendar')} hitSlop={6}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : reminders.length === 0 ? (
          <Text style={styles.emptyText}>No reminders for today yet.</Text>
        ) : (
          reminders.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              onToggle={handleToggle}
              onPress={openReminder}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}

        <Text style={[styles.sectionTitle, styles.quickAddTitle]}>Quick Add</Text>
        <View style={styles.quickAddRow}>
          {QUICK_ADD.map((item) => {
            const type = reminderTypeStyles[item.key];
            return (
              <Pressable key={item.key} style={styles.quickAddItem} onPress={() => router.push(item.path)}>
                <View style={[styles.quickAddIcon, { backgroundColor: type.bg }]}>
                  <MaterialCommunityIcons name={type.icon} size={22} color={type.color} />
                </View>
                <Text style={styles.quickAddLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <BottomNavBar />
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
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  identityText: {
    marginLeft: spacing.sm,
  },
  greeting: {
    ...typography.bodyMuted,
  },
  name: {
    ...typography.h2,
  },
  bell: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  badge: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  aiCardWrap: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    shadowColor: colors.gradientEnd,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  aiIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  aiTextWrap: {
    flex: 1,
  },
  aiTitle: {
    ...typography.h3,
    color: colors.white,
    marginBottom: 2,
  },
  aiSubtitle: {
    ...typography.bodyMuted,
    color: colors.white,
    opacity: 0.9,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.success,
    marginRight: 5,
  },
  statusDotPending: {
    backgroundColor: colors.danger,
    marginLeft: spacing.sm,
  },
  statusText: {
    ...typography.caption,
  },
  viewAll: {
    ...typography.bodyMuted,
    color: colors.primary,
  },
  emptyText: {
    ...typography.bodyMuted,
    marginBottom: spacing.md,
  },
  quickAddTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  quickAddRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.md,
  },
  quickAddItem: {
    alignItems: 'center',
    width: '33.33%',
  },
  quickAddIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  quickAddLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
});
