import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, SectionList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { Avatar } from '../src/components/Avatar.js';
import { NoInternetView } from '../src/components/NoInternetView.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../src/api/index.js';
import { parseServerDate, formatClockTime } from '../src/utils/date.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'sent', label: 'Sent Reminders' },
  { key: 'received', label: 'Received Reminders' },
];

const formatTime = (value) => {
  const d = parseServerDate(value);
  return d ? formatClockTime(d) : '';
};

// The underlying reminder's own scheduled date/time (see the join in
// notifications.service.js's listNotifications) - distinct from
// item.created_at, which is when the notification itself landed.
const formatReminderDateTime = (item) => {
  if (!item.reminder_date) return '';
  const [y, m, d] = String(item.reminder_date).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const dateStr = new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  if (!item.reminder_time) return dateStr;
  const [h, mi] = String(item.reminder_time).slice(0, 5).split(':').map(Number);
  const t = new Date();
  t.setHours(h, mi, 0, 0);
  return `${dateStr} • ${formatClockTime(t)}`;
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
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // True only when the load below failed to reach the server at all (see
  // the catch) - see src/components/NoInternetView.js for why this is
  // tracked separately from a genuinely empty list.
  const [offline, setOffline] = useState(false);
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
      setOffline(false);
    } catch (err) {
      setItems([]);
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
      // Every tab's own pill count, not just the active one - shows all
      // four at once. A cheap 1-item fetch per tab just to read its
      // `total`, not stored in `items`.
      TABS.filter((t) => t.key !== tab).forEach((t) => {
        listNotifications(t.key === 'all' ? undefined : t.key, 1, 1)
          .then((data) => {
            const total = Array.isArray(data) ? data.length : data?.total ?? data?.items?.length ?? 0;
            setCounts((prev) => ({ ...prev, [t.key]: total }));
          })
          .catch(() => {});
      });
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
    // Routes to the same reminder screens the app already has - each of
    // those already shows a read-only detail card to anyone who isn't its
    // owner/manager (see app/reminders/[type].js), so a tap here lands on
    // that card automatically instead of needing its own separate detail
    // screen. A 'note' reminder_type is the removed Business Message
    // feature - reminders/[type].js has no TYPE_CONFIG entry for it either,
    // so it falls through to that screen's own "Unknown reminder type"
    // fallback rather than a route that no longer exists.
    if (item.type !== 'reminder' || !item.reference_id) return;
    if (item.reminder_group_id) {
      router.push(`/group-reminders/${item.reference_id}`);
    } else if (item.reminder_project_id) {
      router.push(`/tasks/${item.reference_id}`);
    } else if (item.reminder_type) {
      router.push({ pathname: `/reminders/${item.reminder_type}`, params: { id: item.reference_id } });
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

      <ScrollView
        horizontal
        style={styles.tabScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {TABS.map((t) => {
          const count = counts[t.key];
          const isActive = tab === t.key;
          return (
            <Pressable
              key={t.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTab(t.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                {t.label}
              </Text>
              {count != null ? (
                <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionList
        sections={sections}
        style={styles.listScroll}
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
          const isRead = !!item.is_read;
          const dateTimeText = formatReminderDateTime(item);
          return (
            <Pressable style={styles.row} onPress={() => handlePress(item)}>
              <Avatar name={item.from_name || item.title} size={44} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                {item.from_name ? <Text style={styles.rowFrom} numberOfLines={1}>From: {item.from_name}</Text> : null}
                {dateTimeText ? (
                  <View style={styles.rowDateRow}>
                    <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.rowDateText}>{dateTimeText}</Text>
                  </View>
                ) : item.body ? (
                  <Text style={styles.rowSubtitle} numberOfLines={1}>{item.body}</Text>
                ) : null}
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTime}>{formatTime(item.created_at)}</Text>
                {!isRead ? <View style={styles.unreadDot} /> : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            offline ? (
              <NoInternetView onRetry={() => load(tab)} />
            ) : (
              <Text style={styles.emptyText}>No notifications yet.</Text>
            )
          ) : null
        }
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
  // ScrollView defaults to flexGrow: 1 internally when no `style` is given
  // (only contentContainerStyle) - without this, the tab row was expanding
  // to fill half the screen's remaining height and vertically centering its
  // pills inside that invisible box (contentContainerStyle's alignItems:
  // 'center' below), which is what showed up as a big empty gap above the
  // tabs. flexGrow: 0 pins it to its natural, one-row content height.
  tabScroll: {
    flexGrow: 0,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
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
  // Explicit flex: 1 so this (not the now flexGrow:0 tab row) claims all the
  // remaining vertical space, with its own content top-aligned inside it.
  listScroll: {
    flex: 1,
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
    gap: spacing.md,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  rowFrom: {
    ...typography.caption,
    marginTop: 1,
  },
  rowSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  rowDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rowDateText: {
    ...typography.caption,
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
