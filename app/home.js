import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { BottomNavBar } from '../src/components/BottomNavBar.js';
import { ReminderRow } from '../src/components/ReminderRow.js';
import { listTodayReminders, completeReminder, getUnreadNotificationCount } from '../src/api/index.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../src/theme.js';

const QUICK_ADD = [
  { key: 'medicine', label: 'Medicine', path: '/reminders/medicine' },
  { key: 'birthday', label: 'Birthday', path: '/reminders/birthday' },
  { key: 'note', label: 'Note', path: '/notes/new' },
  { key: 'custom', label: 'Custom', path: '/reminders/custom' },
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

  const openReminder = (reminder) => {
    router.push({ pathname: `/reminders/${reminder.type}`, params: { id: reminder.id } });
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.push('/profile')}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.name}>{user?.name?.split(' ')[0] || 'there'} 👋</Text>
          </Pressable>
          <Pressable style={styles.bell} onPress={() => router.push('/notifications')} hitSlop={10}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unread > 0 ? <View style={styles.badge} /> : null}
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/ai-chat')}>
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
          </LinearGradient>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Reminders</Text>
          <Pressable onPress={() => router.push('/calendar')}>
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : reminders.length === 0 ? (
          <Text style={styles.emptyText}>No reminders for today yet.</Text>
        ) : (
          reminders.map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} onToggle={handleToggle} onPress={openReminder} />
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.bodyMuted,
  },
  name: {
    ...typography.h2,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
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
    justifyContent: 'space-between',
  },
  quickAddItem: {
    alignItems: 'center',
    width: '23%',
  },
  quickAddIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickAddLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
});
