import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../../../src/components/ScreenContainer.js';
import { Header } from '../../../src/components/Header.js';
import { Avatar } from '../../../src/components/Avatar.js';
import { TextField } from '../../../src/components/TextField.js';
import { Button } from '../../../src/components/Button.js';
import { DoneToggle } from '../../../src/components/DoneToggle.js';
import {
  getReminder,
  completeReminder,
  deleteReminder,
  listReminderUpdates,
  addReminderUpdate,
  getErrorMessage,
} from '../../../src/api/index.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../../src/theme.js';

const REPEAT_LABELS = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const formatDate = (value) => {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return '';
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  const hours = h % 12 || 12;
  const period = h >= 12 ? 'PM' : 'AM';
  return `${hours}:${String(m).padStart(2, '0')} ${period}`;
};

const formatTimestamp = (value) => {
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export default function FamilyReminderDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [reminder, setReminder] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setReminder(await getReminder(id));
    } catch {
      setReminder(null);
    } finally {
      setLoading(false);
    }
    try {
      setUpdates(await listReminderUpdates(id));
    } catch {
      setUpdates([]);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleToggleComplete = async () => {
    try {
      const updated = await completeReminder(id, !reminder.is_completed);
      setReminder(updated);
    } catch (err) {
      Alert.alert('Could not update reminder', getErrorMessage(err));
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.trim()) return;
    setAddingUpdate(true);
    try {
      setUpdates(await addReminderUpdate(id, newUpdate.trim()));
      setNewUpdate('');
    } catch (err) {
      Alert.alert('Could not add update', getErrorMessage(err));
    } finally {
      setAddingUpdate(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete reminder', `Delete "${reminder?.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteReminder(id);
            router.back();
          } catch (err) {
            setDeleting(false);
            Alert.alert('Could not delete reminder', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer edges={['top']} style={styles.container}>
        <Header title="" />
        <Text style={styles.emptyText}>Loading…</Text>
      </ScreenContainer>
    );
  }

  if (!reminder) {
    return (
      <ScreenContainer edges={['top']} style={styles.container}>
        <Header title="" />
        <Text style={styles.emptyText}>Reminder not found.</Text>
      </ScreenContainer>
    );
  }

  const type = reminderTypeStyles[reminder.type] || reminderTypeStyles.custom;
  const canManage = !!reminder.can_manage;

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header title="Reminder Details" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={[styles.iconWrap, { backgroundColor: type.bg }]}>
              <MaterialCommunityIcons name={type.icon} size={22} color={type.color} />
            </View>
            <View style={styles.titleTextWrap}>
              <Text style={styles.title}>{reminder.title}</Text>
              <Pressable style={styles.statusRow} onPress={canManage ? handleToggleComplete : undefined}>
                <DoneToggle done={!!reminder.is_completed} offColor={colors.danger} size={16} />
                <Text style={[styles.statusText, reminder.is_completed && styles.statusTextDone]}>
                  {reminder.is_completed ? 'Completed' : 'Pending'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{formatTime(reminder.reminder_time) || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(reminder.reminder_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="repeat-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Repeat</Text>
            <Text style={styles.detailValue}>{REPEAT_LABELS[reminder.repeat_type] || 'Does not repeat'}</Text>
          </View>
          {reminder.description ? (
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.detailValue}>{reminder.description}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailLabel}>Created by</Text>
            <Text style={styles.detailValue}>{reminder.creator_name || 'Someone'}</Text>
          </View>
          {reminder.recipients?.length ? (
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailLabel}>Shared with</Text>
              <View style={styles.avatarStack}>
                {reminder.recipients.slice(0, 4).map((r) => (
                  <Avatar key={r.id} name={r.name} uri={r.avatar_url} size={24} />
                ))}
                {reminder.recipients.length > 4 ? (
                  <Text style={styles.moreText}>+{reminder.recipients.length - 4}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {updates.length ? (
            updates.map((u) => (
              <View key={u.id} style={styles.updateRow}>
                <Text style={styles.updateNote}>{u.note}</Text>
                <Text style={styles.updateMeta}>
                  {u.user_name} · {formatTimestamp(u.created_at)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No activity yet.</Text>
          )}

          <View style={styles.addUpdateRow}>
            <TextField
              placeholder="Add a note..."
              value={newUpdate}
              onChangeText={setNewUpdate}
              multiline
              containerStyle={styles.addUpdateInput}
              voiceInput
            />
            <Button title="Post" onPress={handleAddUpdate} loading={addingUpdate} variant="outline" />
          </View>
        </View>

        {canManage ? (
          <View style={styles.actionsRow}>
            <Button
              title="Edit"
              variant="outline"
              onPress={() => router.push({ pathname: `/reminders/${reminder.type}`, params: { id: reminder.id } })}
              style={styles.actionBtn}
            />
            <Button title="Delete" onPress={handleDelete} loading={deleting} style={[styles.actionBtn, styles.deleteBtn]} />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextWrap: {
    flex: 1,
  },
  title: {
    ...typography.h3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  statusTextDone: {
    color: colors.success,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  detailLabel: {
    ...typography.bodyMuted,
    width: 80,
  },
  detailValue: {
    ...typography.body,
    flex: 1,
    fontWeight: '600',
  },
  avatarStack: {
    flexDirection: 'row',
    gap: 4,
  },
  moreText: {
    ...typography.caption,
    marginLeft: spacing.xs,
    alignSelf: 'center',
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  updateRow: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  updateNote: {
    ...typography.body,
  },
  updateMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  addUpdateRow: {
    marginTop: spacing.sm,
  },
  addUpdateInput: {
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  deleteBtn: {
    backgroundColor: colors.danger,
  },
});
