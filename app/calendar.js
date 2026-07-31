import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { BottomNavBar } from '../src/components/BottomNavBar.js';
import { ReminderRow, TYPE_LABELS } from '../src/components/ReminderRow.js';
import { ReminderDetailModal } from '../src/components/ReminderDetailModal.js';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { listCalendarReminders, completeReminder, deleteReminder, getErrorMessage } from '../src/api/index.js';
import { resyncLocalReminders } from '../src/utils/localReminders.js';
import { queueOfflineComplete } from '../src/utils/offlineCompleteQueue.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../src/theme.js';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n) => String(n).padStart(2, '0');
const toKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Naive "+s" is wrong for a couple of these (Company -> Companys), so the
// legend/stat tiles get an explicit plural instead of guessing.
const PLURAL_LABELS = {
  medicine: 'Medicines',
  birthday: 'Birthdays',
  anniversary: 'Anniversaries',
  note: 'Messages',
  task: 'Tasks',
  custom: 'Others',
  recharge: 'Recharges',
  event: 'Events',
  alarm: 'Alarms',
  company: 'Companies',
};

// Up to this many type buckets in the legend/stat tiles - the busiest few,
// not every type that ever appears (screen width doesn't allow it).
const MAX_TYPE_BUCKETS = 4;

const monthTypeCounts = (remindersByDate) => {
  const counts = {};
  Object.values(remindersByDate).forEach((dayItems) => {
    (dayItems || []).forEach((r) => {
      counts[r.type] = (counts[r.type] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .filter(([type]) => reminderTypeStyles[type])
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TYPE_BUCKETS)
    .map(([type, count]) => ({ type, count, ...reminderTypeStyles[type] }));
};

const buildGrid = (year, month) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

export default function Calendar() {
  const router = useRouter();
  const { user } = useAuth();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [remindersByDate, setRemindersByDate] = useState({});
  const [loading, setLoading] = useState(true);
  // An id, not the reminder object itself, so toggling "done" from inside
  // the modal re-derives the live row below instead of showing a stale snapshot.
  const [selectedReminderId, setSelectedReminderId] = useState(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => buildGrid(year, month), [year, month]);
  const typeCounts = useMemo(() => monthTypeCounts(remindersByDate), [remindersByDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = toKey(year, month, 1);
      const to = toKey(year, month, new Date(year, month + 1, 0).getDate());
      // Backend returns an object already grouped by reminder_date, e.g.
      // { "2025-07-15": [reminder, ...] } - not a flat array.
      const data = await listCalendarReminders(from, to);
      setRemindersByDate(data && typeof data === 'object' ? data : {});
    } catch {
      setRemindersByDate({});
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const changeMonth = (delta) => {
    const next = new Date(year, month + delta, 1);
    setCursor(next);
    setSelectedDay(1);
  };

  const selectedKey = toKey(year, month, selectedDay);
  const selectedReminders = (remindersByDate[selectedKey] || []).sort((a, b) =>
    (a.reminder_time || '').localeCompare(b.reminder_time || '')
  );
  const selectedReminderDetail = selectedReminders.find((r) => r.id === selectedReminderId) || null;
  const isToday =
    year === today.getFullYear() && month === today.getMonth() && selectedDay === today.getDate();
  const selectedLabel = new Date(year, month, selectedDay).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleToggle = async (reminder) => {
    const next = !reminder.is_completed;
    setRemindersByDate((prev) => ({
      ...prev,
      [selectedKey]: prev[selectedKey].map((r) => (r.id === reminder.id ? { ...r, is_completed: next } : r)),
    }));
    try {
      await completeReminder(reminder.id, next);
      resyncLocalReminders(user?.id);
    } catch (err) {
      if (err?.response) {
        setRemindersByDate((prev) => ({
          ...prev,
          [selectedKey]: prev[selectedKey].map((r) => (r.id === reminder.id ? { ...r, is_completed: !next } : r)),
        }));
      } else {
        queueOfflineComplete(reminder.id, next);
      }
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
          const previous = remindersByDate;
          setRemindersByDate((prev) => ({
            ...prev,
            [selectedKey]: (prev[selectedKey] || []).filter((r) => r.id !== reminder.id),
          }));
          try {
            await deleteReminder(reminder.id);
            resyncLocalReminders(user?.id);
          } catch (err) {
            setRemindersByDate(previous);
            Alert.alert('Could not delete reminder', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  const goToToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today.getDate());
  };
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Calendar</Text>
        <Pressable style={styles.todayBtn} onPress={goToToday} hitSlop={8} disabled={isToday}>
          <Ionicons name="calendar" size={20} color={isToday ? colors.textMuted : colors.primary} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.header}>
          <Pressable style={styles.navBtn} onPress={() => changeMonth(-1)} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.monthLabel}>
            {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable style={styles.navBtn} onPress={() => changeMonth(1)} hitSlop={10}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text
              key={w}
              style={[styles.weekday, i === 0 && styles.weekendSun, i === 6 && styles.weekendSat]}
            >
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const key = toKey(year, month, day);
            const dayReminders = remindersByDate[key] || [];
            // Up to 3 dots, one per distinct type present that day (not one
            // per reminder - a day with 5 medicine reminders still gets a
            // single medicine dot).
            const dayTypes = [...new Set(dayReminders.map((r) => r.type))]
              .filter((type) => reminderTypeStyles[type])
              .slice(0, 3);
            const weekday = i % 7;
            const isSelected = day === selectedDay;
            const isCurrentDay = isCurrentMonth && day === today.getDate();
            return (
              <Pressable key={i} style={styles.cell} onPress={() => setSelectedDay(day)}>
                <View
                  style={[
                    styles.dayCircle,
                    isCurrentDay && !isSelected && styles.dayCircleToday,
                    isSelected && styles.dayCircleActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      weekday === 0 && styles.weekendSun,
                      weekday === 6 && styles.weekendSat,
                      isCurrentDay && !isSelected && styles.dayTextToday,
                      isSelected && styles.dayTextActive,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {dayTypes.length ? (
                  <View style={styles.dotRow}>
                    {dayTypes.map((type) => (
                      <View
                        key={type}
                        style={[
                          styles.dot,
                          { backgroundColor: reminderTypeStyles[type].color },
                          isSelected && styles.dotActive,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {typeCounts.length ? (
          <View style={styles.legendRow}>
            {typeCounts.map(({ type, count, color }) => (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={styles.legendText}>
                  {count} {PLURAL_LABELS[type] || `${TYPE_LABELS[type]}s`}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.listWrap} contentContainerStyle={styles.list}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              {isToday ? 'Today' : selectedLabel.split(',')[0]}
            </Text>
            <Text style={styles.sectionDate}>{selectedLabel}</Text>
          </View>
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/reminders/add', params: { date: selectedKey } })}
            hitSlop={10}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </View>

        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : selectedReminders.length === 0 ? (
          <Text style={styles.emptyText}>No reminders on this day.</Text>
        ) : (
          selectedReminders.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              onToggle={handleToggle}
              onPress={openReminder}
              onEdit={handleEdit}
              onDelete={handleDelete}
              accentBorder
            />
          ))
        )}

        {typeCounts.length ? (
          <View style={styles.statsGrid}>
            {typeCounts.map(({ type, count, color, bg, icon }) => (
              <View key={type} style={[styles.statTile, { backgroundColor: bg }]}>
                <MaterialCommunityIcons name={icon} size={18} color={color} />
                <Text style={[styles.statNumber, { color }]}>{count}</Text>
                <Text style={styles.statLabel}>{PLURAL_LABELS[type] || `${TYPE_LABELS[type]}s`}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <BottomNavBar />
      <ReminderDetailModal
        visible={!!selectedReminderDetail}
        reminder={selectedReminderDetail}
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  screenTitle: {
    ...typography.h2,
  },
  todayBtn: {
    width: 40,
    height: 40,
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
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    ...typography.h3,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  weekday: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  weekendSun: {
    color: colors.danger,
  },
  weekendSat: {
    color: colors.blue,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.sm,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayCircleActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayText: {
    ...typography.body,
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  dayTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
    height: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotActive: {
    backgroundColor: colors.white,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    ...typography.caption,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  statNumber: {
    ...typography.h2,
    marginTop: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  listWrap: {
    flex: 1,
    marginTop: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.h3,
  },
  sectionDate: {
    ...typography.bodyMuted,
    marginTop: 1,
  },
  emptyText: {
    ...typography.bodyMuted,
  },
});
