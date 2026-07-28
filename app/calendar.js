import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { BottomNavBar } from '../src/components/BottomNavBar.js';
import { ReminderRow } from '../src/components/ReminderRow.js';
import { ReminderDetailModal } from '../src/components/ReminderDetailModal.js';
import { listCalendarReminders, completeReminder, deleteReminder, getErrorMessage } from '../src/api/index.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n) => String(n).padStart(2, '0');
const toKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

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
    } catch {
      setRemindersByDate((prev) => ({
        ...prev,
        [selectedKey]: prev[selectedKey].map((r) => (r.id === reminder.id ? { ...r, is_completed: !next } : r)),
      }));
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
          const previous = remindersByDate;
          setRemindersByDate((prev) => ({
            ...prev,
            [selectedKey]: (prev[selectedKey] || []).filter((r) => r.id !== reminder.id),
          }));
          try {
            await deleteReminder(reminder.id);
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
        {!isToday ? (
          <Pressable style={styles.todayBtn} onPress={goToToday} hitSlop={8}>
            <Text style={styles.todayBtnText}>Today</Text>
          </Pressable>
        ) : null}
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
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekday}>{w}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const key = toKey(year, month, day);
            const dayReminders = remindersByDate[key] || [];
            // Completed reminders get a blue dot; anything not yet completed
            // (including daily/weekly/etc. repeaters, which are always "still
            // coming up") gets a green dot. A day can show both if it has a mix.
            const hasCompleted = dayReminders.some((r) => r.is_completed);
            const hasUpcoming = dayReminders.some((r) => !r.is_completed);
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
                      isCurrentDay && !isSelected && styles.dayTextToday,
                      isSelected && styles.dayTextActive,
                    ]}
                  >
                    {day}
                  </Text>
                </View>
                {hasCompleted || hasUpcoming ? (
                  <View style={styles.dotRow}>
                    {hasCompleted ? (
                      <View style={[styles.dot, styles.dotCompleted, isSelected && styles.dotActive]} />
                    ) : null}
                    {hasUpcoming ? (
                      <View style={[styles.dot, styles.dotUpcoming, isSelected && styles.dotActive]} />
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
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
            />
          ))
        )}
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
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  todayBtnText: {
    ...typography.bodyMuted,
    color: colors.primary,
    fontWeight: '700',
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
  dotCompleted: {
    backgroundColor: colors.blue,
  },
  dotUpcoming: {
    backgroundColor: colors.success,
  },
  dotActive: {
    backgroundColor: colors.white,
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
    width: 34,
    height: 34,
    borderRadius: radius.pill,
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
