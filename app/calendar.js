import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { BottomNavBar } from '../src/components/BottomNavBar.js';
import { ReminderRow } from '../src/components/ReminderRow.js';
import { listCalendarReminders, completeReminder } from '../src/api/index.js';
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

  const openReminder = (reminder) => {
    router.push({ pathname: `/reminders/${reminder.type}`, params: { id: reminder.id } });
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => changeMonth(-1)} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.monthLabel}>
          {cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => changeMonth(1)} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
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
          const hasReminders = !!remindersByDate[key]?.length;
          const isSelected = day === selectedDay;
          return (
            <Pressable key={i} style={styles.cell} onPress={() => setSelectedDay(day)}>
              <View style={[styles.dayCircle, isSelected && styles.dayCircleActive]}>
                <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
              </View>
              {hasReminders ? <View style={[styles.dot, isSelected && styles.dotActive]} /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.listWrap} contentContainerStyle={styles.list}>
        <Text style={styles.sectionTitle}>
          {isToday ? 'Today' : selectedLabel.split(',')[0]} • {selectedLabel}
        </Text>

        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : selectedReminders.length === 0 ? (
          <Text style={styles.emptyText}>No reminders on this day.</Text>
        ) : (
          selectedReminders.map((reminder) => (
            <ReminderRow key={reminder.id} reminder={reminder} onToggle={handleToggle} onPress={openReminder} />
          ))
        )}
      </ScrollView>

      <BottomNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  monthLabel: {
    ...typography.h3,
  },
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  weekday: {
    ...typography.caption,
    fontWeight: '600',
    width: `${100 / 7}%`,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 6,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: colors.primary,
  },
  dayText: {
    ...typography.body,
  },
  dayTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  dotActive: {
    backgroundColor: colors.white,
  },
  listWrap: {
    flex: 1,
    marginTop: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMuted,
  },
});
