import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { TextField } from '../../src/components/TextField.js';
import { DateField } from '../../src/components/DateField.js';
import { SelectField } from '../../src/components/SelectField.js';
import { Button } from '../../src/components/Button.js';
import { DoneToggle } from '../../src/components/DoneToggle.js';
import {
  createReminder,
  getReminder,
  updateReminder,
  deleteReminder,
  completeReminder,
  listReminderUpdates,
  addReminderUpdate,
  getErrorMessage,
} from '../../src/api/index.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

const REPEAT_OPTIONS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatTimestamp = (value) => {
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
};

export default function GroupReminderDetail() {
  const router = useRouter();
  const { id, groupId: groupIdParam } = useLocalSearchParams();
  const isNew = id === 'new';
  const typeStyle = reminderTypeStyles.company;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [reminder, setReminder] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!isNew);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const data = await getReminder(id);
      setReminder(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setDate(data.reminder_date || '');
      setTime((data.reminder_time || '').slice(0, 5));
      setRepeat(data.repeat_type || 'none');
    } catch {
      Alert.alert('Could not load reminder', 'Please try again.');
    } finally {
      setLoadingExisting(false);
    }
    try {
      setUpdates(await listReminderUpdates(id));
    } catch {
      setUpdates([]);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!isNew) load();
    }, [load, isNew])
  );

  const canManage = isNew || !!reminder?.can_manage || false;

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    if (!date) {
      Alert.alert('Date required', 'Please select a date.');
      return;
    }
    if (!time) {
      Alert.alert('Time required', 'Please select a time.');
      return;
    }
    setLoading(true);
    try {
      if (isNew) {
        await createReminder({
          type: 'company',
          groupId: groupIdParam,
          title: title.trim(),
          description: description.trim() || undefined,
          reminderDate: date,
          reminderTime: time,
          repeatType: repeat,
        });
      } else {
        await updateReminder(id, {
          title: title.trim(),
          reminderDate: date,
          reminderTime: time,
          repeatType: repeat,
        });
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not save reminder', getErrorMessage(err));
    } finally {
      setLoading(false);
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

  const handleToggleComplete = async () => {
    try {
      const updated = await completeReminder(id, !reminder.is_completed);
      setReminder(updated);
    } catch (err) {
      Alert.alert('Could not update reminder', getErrorMessage(err));
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete reminder', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete reminder', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loadingExisting) {
    return (
      <ScreenContainer>
        <Header title="" />
        <Text style={styles.loadingText}>Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title=""
        right={
          !isNew && canManage ? (
            <Pressable onPress={handleDelete} hitSlop={12}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{isNew ? 'New Group Reminder' : title}</Text>

        <View style={[styles.iconCircle, { backgroundColor: typeStyle.bg }]}>
          <MaterialCommunityIcons name={typeStyle.icon} size={36} color={typeStyle.color} />
        </View>

        {isNew || canManage ? (
          <TextField label="Title" placeholder="Follow up on invoice" value={title} onChangeText={setTitle} voiceInput editable={isNew || canManage} />
        ) : (
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>Title</Text>
            <Text style={styles.readOnlyValue}>{title}</Text>
          </View>
        )}

        {isNew ? (
          <TextField
            label="Task (optional)"
            placeholder="Details about this follow-up"
            value={description}
            onChangeText={setDescription}
            multiline
            style={styles.notesInput}
            voiceInput
          />
        ) : description ? (
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>Task</Text>
            <Text style={styles.readOnlyValue}>{description}</Text>
          </View>
        ) : null}

        {isNew || canManage ? (
          <>
            <DateField label="Date" value={date} onChange={setDate} mode="date" />
            <DateField label="Time" value={time} onChange={setTime} mode="time" />
            <SelectField label="Repeat" value={repeat} options={REPEAT_OPTIONS} onChange={setRepeat} />
          </>
        ) : (
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>When</Text>
            <Text style={styles.readOnlyValue}>{date}{time ? ` · ${time}` : ''}</Text>
          </View>
        )}

        {isNew || canManage ? (
          <Button title={isNew ? 'Create Reminder' : 'Save Changes'} onPress={handleSave} loading={loading} style={styles.submit} />
        ) : null}

        {!isNew ? (
          <Pressable style={styles.completeRow} onPress={canManage ? handleToggleComplete : undefined} disabled={!canManage}>
            <DoneToggle done={!!reminder?.is_completed} />
            <Text style={styles.completeText}>{reminder?.is_completed ? 'Completed' : 'Mark as done'}</Text>
          </Pressable>
        ) : null}

        {!isNew ? (
          <View style={styles.updatesSection}>
            <Text style={styles.sectionTitle}>Updates</Text>
            {updates.length ? (
              updates.map((u) => (
                <View key={u.id} style={styles.updateRow}>
                  <Text style={styles.updateNote}>{u.note}</Text>
                  <Text style={styles.updateMeta}>{u.user_name} · {formatTimestamp(u.created_at)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No updates yet.</Text>
            )}

            {canManage ? (
              <View style={styles.addUpdateRow}>
                <TextField
                  placeholder="Add a progress update..."
                  value={newUpdate}
                  onChangeText={setNewUpdate}
                  multiline
                  containerStyle={styles.addUpdateInput}
                  voiceInput
                />
                <Button title="Post Update" onPress={handleAddUpdate} loading={addingUpdate} variant="outline" />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heading: {
    ...typography.h1,
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  readOnlyField: {
    marginBottom: spacing.md,
  },
  readOnlyLabel: {
    ...typography.bodyMuted,
    marginBottom: spacing.xs,
  },
  readOnlyValue: {
    ...typography.body,
  },
  submit: {
    marginTop: spacing.md,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  completeText: {
    ...typography.body,
    fontWeight: '600',
  },
  updatesSection: {
    marginTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  updateRow: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  updateNote: {
    ...typography.body,
  },
  updateMeta: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  emptyText: {
    ...typography.bodyMuted,
    marginBottom: spacing.sm,
  },
  addUpdateRow: {
    marginTop: spacing.sm,
  },
  addUpdateInput: {
    marginBottom: spacing.sm,
  },
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
