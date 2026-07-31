import { useCallback, useRef, useState } from 'react';
import { View, Text, SectionList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../src/api/index.js';
import { TYPE_LABELS } from '../src/components/ReminderRow.js';
import { parseServerDate, formatClockTime } from '../src/utils/date.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../src/theme.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'reminder', label: 'Reminders' },
];

// Falls back to a generic bell whenever a notification doesn't carry the
// underlying reminder's specific type (e.g. non-reminder notifications, or
// older rows from before this field existed) - same push payload shape
// _layout.js already trusts for its own notification-tap routing.
const iconFor = (item) => {
  const reminderType = item.data?.reminderType;
  if (reminderType && reminderTypeStyles[reminderType]) return reminderTypeStyles[reminderType];
  return { icon: 'bell-outline', color: colors.primary, bg: colors.primaryLight };
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

const PAGE_SIZE = 30;

export default function Notifications() {
  const router = useRouter();
  const [tab, setTab] = useState('all');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ all: null, reminder: null });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const load = useCallback(async (activeTab) => {
    pageRef.current = 1;
    try {
      const data = await listNotifications(activeTab === 'all' ? undefined : activeTab, 1, PAGE_SIZE);
      const list = Array.isArray(data) ? data : data?.items || [];
      const total = Array.isArray(data) ? list.length : data?.total ?? list.length;
      setItems(list);
      setHasMore(Array.isArray(data) ? false : list.length < total);
      setCounts((prev) => ({ ...prev, [activeTab]: total }));
    } catch {
      setItems([]);
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
      const data = await listNotifications(tab === 'all' ? undefined : tab, nextPage, PAGE_SIZE);
      const list = Array.isArray(data) ? data : data?.items || [];
      if (list.length) {
        pageRef.current = nextPage;
        setItems((prev) => [...prev, ...list]);
      }
      const total = Array.isArray(data) ? null : data?.total;
      setHasMore(total != null ? pageRef.current * PAGE_SIZE < total : list.length === PAGE_SIZE);
    } catch {
      // Leave hasMore as-is - a transient failure shouldn't stop future scroll attempts.
    } finally {
      setLoadingMore(false);
    }
  }, [tab, hasMore, loadingMore]);

  useFocusEffect(
    useCallback(() => {
      load(tab);
      // The pill for the tab that *isn't* active also needs a real count -
      // a cheap 1-item fetch just to read its `total`, not stored in `items`.
      const otherTab = tab === 'all' ? 'reminder' : 'all';
      listNotifications(otherTab === 'all' ? undefined : otherTab, 1, 1)
        .then((data) => {
          const total = Array.isArray(data) ? data.length : data?.total ?? data?.items?.length ?? 0;
          setCounts((prev) => ({ ...prev, [otherTab]: total }));
        })
        .catch(() => {});
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
  ).map((section, index) => ({ ...section, index }));

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const count = counts[t.key];
          const isActive = tab === t.key;
          return (
            <Pressable
              key={t.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTab(t.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
              {count != null ? (
                <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.index === 0 ? (
              <Pressable onPress={handleMarkAll} hitSlop={8}>
                <Text style={styles.markAllText}>Mark all as read</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => {
          const icon = iconFor(item);
          const typeLabel = TYPE_LABELS[item.data?.reminderType];
          const isRead = !!item.is_read;
          return (
            <Pressable style={styles.row} onPress={() => handlePress(item)}>
              {!isRead ? <View style={styles.rowUnreadDot} /> : null}
              <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                <MaterialCommunityIcons name={icon.icon} size={20} color={icon.color} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                {item.body ? <Text style={styles.rowSubtitle} numberOfLines={1}>{item.body}</Text> : null}
                {typeLabel ? (
                  <View style={[styles.typeTag, { backgroundColor: icon.bg }]}>
                    <MaterialCommunityIcons name={icon.icon} size={11} color={icon.color} />
                    <Text style={[styles.typeTagText, { color: icon.color }]}>{typeLabel}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTime}>{formatTime(item.created_at)}</Text>
                {isRead ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.textMuted} />
                ) : (
                  <View style={styles.unreadDot} />
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No notifications yet.</Text> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.bodyMuted,
  },
  tabTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  tabCount: {
    minWidth: 22,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabCountText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabCountTextActive: {
    color: colors.white,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  footerLoader: {
    marginVertical: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.h3,
  },
  markAllText: {
    ...typography.bodyMuted,
    color: colors.primary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowUnreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
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
  typeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  typeTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowMeta: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
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
