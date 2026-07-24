import { View, Text, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../theme.js';
import { formatClockTime } from '../utils/date.js';

// reminder_time comes back from the backend as a bare "HH:mm:ss", so it's
// anchored to an arbitrary date just to get a parseable Date object.
const formatTime = (value) => {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : `1970-01-01T${value}`);
  return Number.isNaN(d.getTime()) ? value : formatClockTime(d);
};

export const ReminderRow = ({ reminder, onToggle, onPress, onDelete }) => {
  const type = reminderTypeStyles[reminder.type] || reminderTypeStyles.custom;
  const title = reminder.title || 'Reminder';
  const isCompleted = !!reminder.is_completed;
  const subtitle = reminder.reminder_time ? formatTime(reminder.reminder_time) : reminder.reminder_date;

  return (
    <Pressable style={styles.row} onPress={onPress && (() => onPress(reminder))}>
      <View style={[styles.iconWrap, { backgroundColor: type.bg }]}>
        <MaterialCommunityIcons name={type.icon} size={20} color={type.color} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onToggle ? (
        <Pressable hitSlop={10} onPress={() => onToggle(reminder)} style={onDelete && styles.actionSpacing}>
          <Ionicons
            name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={isCompleted ? colors.success : colors.textMuted}
          />
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable hitSlop={10} onPress={() => onDelete(reminder)}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
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
