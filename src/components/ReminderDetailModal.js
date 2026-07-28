import { View, Text, Modal, ScrollView, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from './Button.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../theme.js';
import { formatClockTime } from '../utils/date.js';
import { speakReminder } from '../utils/speech.js';

const REPEAT_LABELS = {
  none: 'Does not repeat',
  daily: 'Repeats daily',
  weekly: 'Repeats weekly',
  monthly: 'Repeats monthly',
  yearly: 'Repeats yearly',
};

// reminder_time comes back as bare "HH:mm:ss" - anchored to an arbitrary date
// just to get a parseable Date object, same trick ReminderRow uses.
const formatTime = (value) => {
  if (!value) return '';
  const d = new Date(value.includes('T') ? value : `1970-01-01T${value}`);
  return Number.isNaN(d.getTime()) ? value : formatClockTime(d);
};

// reminder_date is a plain "YYYY-MM-DD" - parsed as a local calendar date
// (not through Date's UTC-ish string parsing) so it can't drift a day
// depending on the device's timezone offset.
const formatDate = (value) => {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

// A read-only "what's actually in this reminder" card - opened by tapping a
// ReminderRow (Home, Calendar, Reminder History) or by the due-reminder
// alert itself (ReminderAlertWatcher), instead of jumping straight into the
// edit form. Edit/Delete live in the footer here for anyone who does want to
// change something, plus ReminderRow's own "..." icon offers the same two
// actions without opening this card first.
export const ReminderDetailModal = ({ visible, reminder, onClose, onToggle, onEdit, onDelete }) => {
  if (!reminder) return null;
  const type = reminderTypeStyles[reminder.type] || reminderTypeStyles.custom;
  const isCompleted = !!reminder.is_completed;
  const checklist = Array.isArray(reminder.checklist_items) ? reminder.checklist_items : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />

          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: type.bg }]}>
              <MaterialCommunityIcons name={type.icon} size={24} color={type.color} />
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {reminder.title || 'Reminder'}
            </Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>{formatDate(reminder.reminder_date)}</Text>
            </View>
            {reminder.reminder_time ? (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.metaText}>{formatTime(reminder.reminder_time)}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons name="repeat-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.metaText}>{REPEAT_LABELS[reminder.repeat_type] || 'Does not repeat'}</Text>
            </View>

            {onToggle ? (
              <Pressable style={styles.completeRow} onPress={() => onToggle(reminder)}>
                <Ionicons
                  name={isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={isCompleted ? colors.success : colors.danger}
                />
                <Text style={[styles.completeText, isCompleted && styles.completeTextDone]}>
                  {isCompleted ? 'Marked as done' : 'Mark as done'}
                </Text>
              </Pressable>
            ) : null}

            {reminder.dosage ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Dosage / Amount</Text>
                <Text style={styles.sectionValue}>{reminder.dosage}</Text>
              </View>
            ) : null}

            {reminder.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Notes</Text>
                <Text style={styles.sectionValue}>{reminder.description}</Text>
              </View>
            ) : null}

            {checklist.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Checklist</Text>
                {checklist.map((item, index) => (
                  <View key={index} style={styles.checklistRow}>
                    <Ionicons
                      name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                      size={18}
                      color={item.done ? colors.success : colors.textMuted}
                    />
                    <Text style={[styles.checklistText, item.done && styles.checklistTextDone]}>{item.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {reminder.voice_message ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Voice Message</Text>
                <View style={styles.voiceRow}>
                  <Text style={[styles.sectionValue, styles.voiceText]}>{reminder.voice_message}</Text>
                  <Pressable hitSlop={10} onPress={() => speakReminder(reminder.voice_message)}>
                    <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            ) : null}

            {reminder.wish_message ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>WhatsApp Wish</Text>
                <Text style={styles.sectionValue}>{reminder.wish_message}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {onDelete ? (
              <Pressable style={styles.deleteBtn} onPress={() => onDelete(reminder)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            ) : null}
            {onEdit ? <Button title="Edit Reminder" onPress={() => onEdit(reminder)} style={styles.editBtn} /> : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
    paddingBottom: spacing.lg,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  title: {
    ...typography.h3,
    flex: 1,
    marginRight: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  metaText: {
    ...typography.bodyMuted,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  completeText: {
    ...typography.body,
    fontWeight: '600',
  },
  completeTextDone: {
    color: colors.success,
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  sectionValue: {
    ...typography.body,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  checklistText: {
    ...typography.body,
    flex: 1,
  },
  checklistTextDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteBtnText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
  editBtn: {
    flex: 1,
  },
});
