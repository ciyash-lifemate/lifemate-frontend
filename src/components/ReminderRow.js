import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DoneToggle } from './DoneToggle.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../theme.js';
import { formatClockTime } from '../utils/date.js';

// reminder_time comes back from the backend as a bare "HH:mm:ss", so it's
// anchored to an arbitrary date just to get a parseable Date object.
const formatTime = (value) => {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : `1970-01-01T${value}`);
  return Number.isNaN(d.getTime()) ? value : formatClockTime(d);
};

// Exported for reuse anywhere else a reminder type needs a display label
// (e.g. the notification list's per-type tag).
export const TYPE_LABELS = {
  medicine: 'Medicine',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  note: 'Message',
  task: 'Task',
  custom: 'Other',
  recharge: 'Recharge',
  event: 'Event',
  alarm: 'Alarm',
  company: 'Company',
};

// `onPress` opens a read-only detail card (ReminderDetailModal) rather than
// jumping straight into editing - `onEdit`/`onDelete` back a single "..."
// icon instead of separate buttons, so the row doesn't get cluttered with
// icons for every possible action.
// `accentBorder` adds a colored left edge matching the type's accent color -
// opt-in (Calendar's day list wants it) rather than the default everywhere
// ReminderRow is used (Home's list doesn't).
export const ReminderRow = ({ reminder, onToggle, onPress, onEdit, onDelete, accentBorder }) => {
  const type = reminderTypeStyles[reminder.type] || reminderTypeStyles.custom;
  const title = reminder.title || 'Reminder';
  const isCompleted = !!reminder.is_completed;
  const typeLabel = TYPE_LABELS[reminder.type];
  const when = reminder.reminder_time ? formatTime(reminder.reminder_time) : reminder.reminder_date;
  const subtitle = when && typeLabel ? `${when} • ${typeLabel}` : when || typeLabel;
  const hasOptions = !!(onEdit || onDelete);

  const handleOptions = () => {
    const buttons = [];
    if (onEdit) buttons.push({ text: 'Edit', onPress: () => onEdit(reminder) });
    if (onDelete) buttons.push({ text: 'Delete', style: 'destructive', onPress: () => onDelete(reminder) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(title, 'What would you like to do?', buttons);
  };

  return (
    <Pressable
      style={[styles.row, accentBorder && { borderLeftWidth: 4, borderLeftColor: type.color }]}
      onPress={onPress && (() => onPress(reminder))}
    >
      <View style={[styles.iconWrap, { backgroundColor: type.bg }]}>
        <MaterialCommunityIcons name={type.icon} size={20} color={type.color} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onToggle ? (
        <View style={hasOptions && styles.actionSpacing}>
          <DoneToggle done={isCompleted} onPress={() => onToggle(reminder)} offColor={colors.danger} />
        </View>
      ) : null}
      {hasOptions ? (
        <Pressable hitSlop={10} onPress={handleOptions}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  actionSpacing: {
    marginRight: spacing.md,
  },
});
