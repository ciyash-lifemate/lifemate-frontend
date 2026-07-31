import { useCallback, useState } from 'react';
import { View, Text, SectionList, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { DoneToggle } from '../../src/components/DoneToggle.js';
import { listSharedReminders, completeReminder, getErrorMessage } from '../../src/api/index.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'My Reminders' },
  { key: 'shared', label: 'Shared with Me' },
];

const formatTime = (value) => {
  if (!value) return '';
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  const hours = h % 12 || 12;
  const period = h >= 12 ? 'PM' : 'AM';
  return `${hours}:${String(m).padStart(2, '0')} ${period}`;
};

const groupLabel = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  if (d < today) return 'Earlier';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
};

export default function SharedReminders() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (activeTab) => {
    setLoading(true);
    try {
      const data = await listSharedReminders(activeTab);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [load, tab])
  );

  const handleToggle = async (reminder) => {
    const next = !reminder.is_completed;
    setItems((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_completed: next } : r)));
    try {
      await completeReminder(reminder.id, next);
    } catch (err) {
      setItems((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, is_completed: !next } : r)));
      Alert.alert('Could not update', getErrorMessage(err));
    }
  };

  const sections = Object.values(
    items.reduce((acc, item) => {
      const label = groupLabel(item.reminder_date);
      if (!acc[label]) acc[label] = { title: label, data: [] };
      acc[label].data.push(item);
      return acc;
    }, {})
  );

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header title="Shared Reminders" />

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => {
          const type = reminderTypeStyles[item.type] || reminderTypeStyles.custom;
          const isMine = String(item.user_id) === String(user?.id);
          const subtitle = isMine
            ? `${formatTime(item.reminder_time)} • Shared by you`
            : `${formatTime(item.reminder_time)} • ${item.creator_name || 'Family'}`;
          return (
            <Pressable style={styles.row} onPress={() => router.push(`/family/reminder/${item.id}`)}>
              <View style={[styles.iconWrap, { backgroundColor: type.bg }]}>
                <MaterialCommunityIcons name={type.icon} size={20} color={type.color} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
              </View>
              <DoneToggle done={!!item.is_completed} onPress={() => handleToggle(item)} offColor={colors.danger} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {tab === 'mine'
                ? "You haven't shared any reminders yet."
                : tab === 'shared'
                ? 'Nothing shared with you yet.'
                : 'No shared reminders yet.'}
            </Text>
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.white,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyMuted,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  rowSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
