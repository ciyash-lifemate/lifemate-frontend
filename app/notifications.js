import { useCallback, useState } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../src/api/index.js';
import { parseServerDate, formatClockTime } from '../src/utils/date.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'reminder', label: 'Reminders' },
  { key: 'chat', label: 'Chats' },
];

const iconFor = (type) => {
  if (type === 'chat') return { lib: 'ionicons', name: 'chatbubble-ellipses-outline' };
  if (type === 'reminder') return { lib: 'mci', name: 'bell-outline' };
  return { lib: 'mci', name: 'information-outline' };
};

const formatTime = (value) => {
  const d = parseServerDate(value);
  return d ? formatClockTime(d) : '';
};

const groupLabel = (value) => {
  const d = parseServerDate(value);
  if (!d) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
};

export default function Notifications() {
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (activeTab) => {
    try {
      const data = await listNotifications(activeTab === 'all' ? undefined : activeTab);
      setItems(Array.isArray(data) ? data : data?.items || []);
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

  const handleTab = (key) => {
    setTab(key);
    setLoading(true);
    // load() re-runs on its own: it's in the useFocusEffect above, and
    // changing `tab` recreates that callback while the screen is focused.
  };

  const handlePress = async (item) => {
    if (!item.is_read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      markNotificationRead(item.id).catch(() => {});
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    markAllNotificationsRead().catch(() => {});
  };

  const sections = Object.values(
    items.reduce((acc, item) => {
      const label = groupLabel(item.created_at);
      if (!acc[label]) acc[label] = { title: label, data: [] };
      acc[label].data.push(item);
      return acc;
    }, {})
  );

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable onPress={handleMarkAll} hitSlop={12}>
          <Ionicons name="checkmark-done-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => handleTab(t.key)}
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
          const icon = iconFor(item.type);
          return (
            <Pressable style={styles.row} onPress={() => handlePress(item)}>
              <View style={styles.iconWrap}>
                {icon.lib === 'ionicons' ? (
                  <Ionicons name={icon.name} size={20} color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name={icon.name} size={20} color={colors.primary} />
                )}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                {item.body ? <Text style={styles.rowSubtitle} numberOfLines={1}>{item.body}</Text> : null}
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTime}>{formatTime(item.created_at)}</Text>
                {!item.is_read ? <View style={styles.unreadDot} /> : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No notifications yet.</Text> : null}
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
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    ...typography.bodyMuted,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyMuted,
    fontWeight: '600',
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
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
  rowMeta: {
    alignItems: 'flex-end',
  },
  rowTime: {
    ...typography.caption,
    marginBottom: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
