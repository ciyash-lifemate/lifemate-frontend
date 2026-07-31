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
  listCalendarReminders,
  completeReminder,
  deleteReminder,
  getUnreadNotificationCount,
  getErrorMessage,
} from '../src/api/index.js';
import { useAuth } from '../src/context/AuthContext.js';
import { resyncLocalReminders } from '../src/utils/localReminders.js';
import { queueOfflineComplete } from '../src/utils/offlineCompleteQueue.js';
import { formatClockTime } from '../src/utils/date.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../src/theme.js';

const QUICK_ADD = [
  { key: 'medicine', label: 'Medicine', path: '/reminders/medicine' },
  { key: 'birthday', label: 'Birthday', path: '/reminders/birthday' },
  // Not a reminder (separate `notes` table, no `type` field) - given its
  // own icon rather than sharing reminderTypeStyles.note, which is now the
  // Business Message feature's look, so the two tiles don't read as the
  // same thing.
  { key: 'note', label: 'Note', path: '/notes', style: { color: colors.warning, bg: '#FDF3E1', icon: 'note-text' } },
  { key: 'event', label: 'Event/Meeting', path: '/reminders/event' },
  { key: 'alarm', label: 'Alarm', path: '/reminders/alarm' },
  { key: 'custom', label: 'Others', path: '/reminders/custom' },
  // Not a reminder either (its own fitness_logs table, one row per day) -
  // own icon for the same reason 'note' above has one.
  { key: 'fitness', label: 'Fitness', path: '/fitness', style: { color: colors.success, bg: '#E7F8ED', icon: 'run' } },
  // Business Message feature - moved here from the Business row. Own key
  // ('message', not 'note') since the personal Note tile above already
  // uses 'note' and both now live in the same list.
  {
    key: 'message',
    label: 'Message',
    path: '/business-notes',
    style: { color: '#1D4ED8', bg: '#DBEAFE', icon: 'message-text-outline' },
  },
];

const QUICK_ADD_BUSINESS = [
  { key: 'company', label: 'Companies', path: '/companies' },
  { key: 'task', label: 'Tasks', path: '/tasks' },
  {
    key: 'family',
    label: 'Family Sharing',
    path: '/family',
    style: { color: colors.pink, bg: '#FDE8F0', icon: 'account-heart' },
  },
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Next 7 days' events, flattened out of the calendar's per-date grouping and
// capped to the soonest few - a lightweight teaser, not a full agenda (that's
// what "View Calendar" is for).
const UPCOMING_DAYS_AHEAD = 7;
const UPCOMING_LIMIT = 3;

// Home is a teaser, not the full agenda - cap the visible list so a busy day
// (10-15 reminders) doesn't turn the whole screen into one long scroll.
// "View all" (-> Calendar, already on today) is where the rest live.
const HOME_REMINDERS_LIMIT = 3;

// reminder_time comes back as a bare "HH:mm:ss" - anchor it to an arbitrary
// date just to get a parseable Date for formatClockTime (same trick as
// ReminderRow's own formatTime).
const formatTime = (value) => {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : `1970-01-01T${value}`);
  return Number.isNaN(d.getTime()) ? value : formatClockTime(d);
};

const MOTIVATION_QUOTES = [
  'Small steps every day lead to big changes.',
  'Discipline is choosing between what you want now and what you want most.',
  "Consistency is what transforms average into excellence.",
  'A little progress each day adds up to big results.',
  'Done is better than perfect.',
  'Your future is created by what you do today, not tomorrow.',
];
const dayOfYear = (d) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // An id, not the reminder object itself, so toggling "done" from inside
  // the modal re-derives the live row below instead of showing a stale snapshot.
  const [selectedReminderId, setSelectedReminderId] = useState(null);
  const selectedReminder = reminders.find((r) => r.id === selectedReminderId) || null;
  const motivationQuote = MOTIVATION_QUOTES[dayOfYear(new Date()) % MOTIVATION_QUOTES.length];

  const load = useCallback(async () => {
    try {
      const today = new Date();
      const from = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
      const to = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + UPCOMING_DAYS_AHEAD));
      const [todayReminders, unreadCount, upcomingByDate] = await Promise.all([
        listTodayReminders().catch(() => []),
        getUnreadNotificationCount().catch(() => 0),
        listCalendarReminders(from, to).catch(() => ({})),
      ]);
      setReminders(Array.isArray(todayReminders) ? todayReminders : todayReminders?.items || []);
      setUnread(typeof unreadCount === 'number' ? unreadCount : unreadCount?.count || 0);
      const flatUpcoming = Object.entries(upcomingByDate && typeof upcomingByDate === 'object' ? upcomingByDate : {})
        .flatMap(([date, items]) => (items || []).map((r) => ({ ...r, reminder_date: date })))
        .sort((a, b) => `${a.reminder_date}${a.reminder_time || ''}`.localeCompare(`${b.reminder_date}${b.reminder_time || ''}`))
        .slice(0, UPCOMING_LIMIT);
      setUpcoming(flatUpcoming);
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
      resyncLocalReminders(user?.id);
    } catch (err) {
      if (err?.response) {
        // The server itself rejected it - a real failure, revert the tap.
        setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_completed: !next } : r)));
      } else {
        // No network - keep the optimistic tap and replay it once
        // LocalReminderSync's next foreground sync succeeds, instead of
        // silently reverting something the user clearly meant to do.
        queueOfflineComplete(reminder.id, next);
      }
    }
  };

  const completedCount = reminders.filter((r) => r.is_completed).length;

  const renderQuickAddItem = (item) => {
    const type = item.style || reminderTypeStyles[item.key];
    return (
      <Pressable key={item.key} style={styles.quickAddItem} onPress={() => router.push(item.path)}>
        <View style={[styles.quickAddIcon, { backgroundColor: type.bg }]}>
          <MaterialCommunityIcons name={type.icon} size={22} color={type.color} />
        </View>
        <Text style={styles.quickAddLabel}>{item.label}</Text>
      </Pressable>
    );
  };

  const openReminder = (reminder) => setSelectedReminderId(reminder.id);

  const handleEdit = (reminder) => {
    setSelectedReminderId(null);
    // Group reminders (Company -> Project -> Group) get their own screen -
    // permission-gated editing and the append-only update thread don't fit
    // the generic per-type reminder form.
    if (reminder.group_id) {
      router.push(`/group-reminders/${reminder.id}`);
      return;
    }
    // Project Tasks get their own screen too - single-assignee delegation
    // (with a creator/assignee view split) doesn't fit the generic form.
    if (reminder.project_id) {
      router.push(`/tasks/${reminder.id}`);
      return;
    }
    // Business Notes (type 'note') have no TYPE_CONFIG entry in the
    // generic form - they get their own screen too.
    if (reminder.type === 'note') {
      router.push(`/business-notes/${reminder.id}`);
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
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/ai-chat')} style={styles.aiCardWrap}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.aiCard}>
            <View style={styles.aiTopRow}>
              <View style={styles.aiIconWrap}>
                <MaterialCommunityIcons name="robot-happy-outline" size={26} color={colors.white} />
              </View>
              <View style={styles.aiTextWrap}>
                <View style={styles.aiTitleRow}>
                  <Text style={styles.aiTitle}>LifeMate</Text>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI</Text>
                  </View>
                </View>
                <Text style={styles.aiSubtitle}>
                  {reminders.length > 0
                    ? `You have ${reminders.length} reminder${reminders.length === 1 ? '' : 's'} today.`
                    : 'You are all caught up today.'}{'\n'}Stay productive 💪
                </Text>
              </View>
            </View>
            <View style={styles.askAiBtn}>
              <Text style={styles.askAiBtnText}>Ask AI</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.statNumber}>{reminders.length}</Text>
            <Text style={styles.statLabel}>Reminders Today</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#E7F8ED' }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
            </View>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Reminders</Text>
          <Pressable onPress={() => router.push('/calendar')} hitSlop={6}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : reminders.length === 0 ? (
          <Text style={styles.emptyText}>No reminders for today yet.</Text>
        ) : (
          reminders.slice(0, HOME_REMINDERS_LIMIT).map((reminder) => (
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
          {QUICK_ADD.map(renderQuickAddItem)}
          <Pressable style={styles.quickAddItem} onPress={() => router.push('/reminders/add')}>
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.quickAddPlus}>
              <Ionicons name="add" size={24} color={colors.white} />
            </LinearGradient>
            <Text style={styles.quickAddLabel}>More</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionTitle, styles.quickAddTitle]}>Business</Text>
        <View style={styles.quickAddRow}>{QUICK_ADD_BUSINESS.map(renderQuickAddItem)}</View>

        {upcoming.length > 0 ? (
          <>
            <View style={[styles.sectionHeader, styles.quickAddTitle]}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              <Pressable onPress={() => router.push('/calendar')} hitSlop={6}>
                <Text style={styles.viewAll}>View Calendar</Text>
              </Pressable>
            </View>
            <View style={styles.upcomingRow}>
              {upcoming.map((item) => {
                const d = new Date(`${item.reminder_date}T00:00:00`);
                return (
                  <Pressable key={item.id} style={styles.upcomingCard} onPress={() => handleEdit(item)}>
                    <View style={styles.upcomingDateBadge}>
                      <Text style={styles.upcomingMonth}>{MONTH_SHORT[d.getMonth()]}</Text>
                      <Text style={styles.upcomingDay}>{d.getDate()}</Text>
                      <Text style={styles.upcomingWeekday}>{WEEKDAY_SHORT[d.getDay()]}</Text>
                    </View>
                    <View style={styles.upcomingBody}>
                      <Text style={styles.upcomingTitle} numberOfLines={2}>{item.title}</Text>
                      <View style={styles.upcomingMetaRow}>
                        <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                        <Text style={styles.upcomingMeta}>
                          {item.reminder_time ? formatTime(item.reminder_time) : 'All Day'}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <View style={styles.motivationCard}>
          <Ionicons name="sparkles" size={18} color={colors.primary} style={styles.motivationIcon} />
          <View style={styles.motivationTextWrap}>
            <Text style={styles.motivationLabel}>Today's Motivation</Text>
            <Text style={styles.motivationQuote}>“{motivationQuote}”</Text>
          </View>
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
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    borderRadius: radius.pill,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
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
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  aiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  aiTitle: {
    ...typography.h3,
    color: colors.white,
  },
  aiBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  aiSubtitle: {
    ...typography.bodyMuted,
    color: colors.white,
    opacity: 0.9,
  },
  askAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  askAiBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statNumber: {
    ...typography.h2,
  },
  statLabel: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
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
  quickAddPlus: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  quickAddLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
  upcomingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  upcomingCard: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  upcomingDateBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
  },
  upcomingMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  upcomingDay: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  upcomingWeekday: {
    fontSize: 10,
    color: colors.textMuted,
  },
  upcomingBody: {
    flex: 1,
    justifyContent: 'center',
  },
  upcomingTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  upcomingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  upcomingMeta: {
    ...typography.caption,
  },
  motivationCard: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  motivationIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  motivationTextWrap: {
    flex: 1,
  },
  motivationLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  motivationQuote: {
    ...typography.body,
    fontStyle: 'italic',
  },
});
