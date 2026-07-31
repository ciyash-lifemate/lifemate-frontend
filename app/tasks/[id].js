import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Share, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { TextField } from '../../src/components/TextField.js';
import { DateField } from '../../src/components/DateField.js';
import { SelectField } from '../../src/components/SelectField.js';
import { AssigneePicker } from '../../src/components/AssigneePicker.js';
import { Button } from '../../src/components/Button.js';
import { DoneToggle } from '../../src/components/DoneToggle.js';
import {
  createReminder,
  getReminder,
  updateReminder,
  deleteReminder,
  completeReminder,
  listCompanies,
  listProjects,
  getErrorMessage,
} from '../../src/api/index.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { resyncLocalReminders } from '../../src/utils/localReminders.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

const REPEAT_OPTIONS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const buildShareMessage = (title, description, date, time) => {
  const when = time ? `${date} at ${time}` : date;
  return `Task: ${title}${description ? `\n${description}` : ''}\nDue: ${when}`;
};

export default function TaskDetail() {
  const router = useRouter();
  const { user } = useAuth();
  const { id, projectId: projectIdParam } = useLocalSearchParams();
  const isNew = id === 'new';
  // Reached two ways: from a Project's own "+ Add Task" (projectId already
  // known, no picker needed) or from the Tasks tab's "+" (nothing picked
  // yet - ask which Company/Project this belongs to before anything else).
  const needsProjectPicker = isNew && !projectIdParam;
  const typeStyle = reminderTypeStyles.task;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [assignee, setAssignee] = useState(null);
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!isNew);
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(needsProjectPicker);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const data = await getReminder(id);
        setReminder(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setDate(data.reminder_date || '');
        setTime((data.reminder_time || '').slice(0, 5));
        setRepeat(data.repeat_type || 'none');
        setAssignee(data.recipients?.[0] || null);
      } catch {
        Alert.alert('Could not load task', 'Please try again.');
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [id, isNew]);

  useEffect(() => {
    if (!needsProjectPicker) return;
    (async () => {
      try {
        setCompanies(await listCompanies());
      } catch {
        setCompanies([]);
      } finally {
        setLoadingCompanies(false);
      }
    })();
  }, [needsProjectPicker]);

  useEffect(() => {
    if (!companyId) {
      setProjects([]);
      return;
    }
    (async () => {
      try {
        setProjects(await listProjects(companyId));
      } catch {
        setProjects([]);
      }
    })();
  }, [companyId]);

  const isCreator = isNew || String(reminder?.user_id) === String(user?.id);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    if (needsProjectPicker && !projectId) {
      Alert.alert('Project required', 'Please choose which company and project this task belongs to.');
      return;
    }
    if (!date) {
      Alert.alert('Date required', 'Please select a due date.');
      return;
    }
    if (!time) {
      Alert.alert('Time required', 'Please select a due time.');
      return;
    }

    const payload = {
      type: 'task',
      title: title.trim(),
      description: description.trim() || undefined,
      reminderDate: date,
      reminderTime: time,
      repeatType: repeat,
      recipientUserIds: assignee ? [assignee.id] : [],
      ...(isNew ? { projectId: projectIdParam || projectId } : {}),
    };

    setLoading(true);
    try {
      if (isNew) {
        await createReminder(payload);
      } else {
        await updateReminder(id, payload);
      }
      resyncLocalReminders(user?.id);
      router.back();
    } catch (err) {
      Alert.alert('Could not save task', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ message: buildShareMessage(title.trim(), description.trim(), date, time) });
    } catch {
      // Best-effort - the share sheet itself already surfaces its own errors.
    }
  };

  const handleToggleComplete = async () => {
    try {
      const updated = await completeReminder(id, !reminder.is_completed);
      setReminder(updated);
      resyncLocalReminders(user?.id);
    } catch (err) {
      Alert.alert('Could not update task', getErrorMessage(err));
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete task', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteReminder(id);
            resyncLocalReminders(user?.id);
            router.back();
          } catch (err) {
            setDeleting(false);
            Alert.alert('Could not delete task', getErrorMessage(err));
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
          !isNew && isCreator ? (
            <Pressable onPress={handleDelete} hitSlop={12} disabled={deleting}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{isNew ? 'New Task' : title}</Text>

        <View style={[styles.iconCircle, { backgroundColor: typeStyle.bg }]}>
          <MaterialCommunityIcons name={typeStyle.icon} size={36} color={typeStyle.color} />
        </View>

        {isCreator ? (
          <>
            {needsProjectPicker ? (
              companies.length ? (
                <>
                  <SelectField
                    label="Company"
                    value={companyId}
                    options={companies.map((c) => ({ value: String(c.id), label: c.name }))}
                    onChange={(value) => {
                      setCompanyId(value);
                      setProjectId('');
                    }}
                  />
                  {companyId ? (
                    projects.length ? (
                      <SelectField
                        label="Project"
                        value={projectId}
                        options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
                        onChange={setProjectId}
                      />
                    ) : (
                      <Text style={styles.pickerHint}>This company has no projects yet - add one first.</Text>
                    )
                  ) : null}
                </>
              ) : !loadingCompanies ? (
                <Text style={styles.pickerHint}>You need a Company and Project before adding a task.</Text>
              ) : null
            ) : null}

            <TextField label="Title" placeholder="Call Ramesh about invoice" value={title} onChangeText={setTitle} voiceInput />
            <TextField
              label="Notes (optional)"
              placeholder="Details about this task"
              value={description}
              onChangeText={setDescription}
              multiline
              style={styles.notesInput}
              voiceInput
            />
            <DateField label="Due Date" value={date} onChange={setDate} mode="date" />
            <DateField label="Due Time" value={time} onChange={setTime} mode="time" />
            <SelectField label="Repeat" value={repeat} options={REPEAT_OPTIONS} onChange={setRepeat} />

            <AssigneePicker value={assignee} onChange={setAssignee} />

            <Text style={styles.shareHint}>
              Not on the app, or want to nudge them yourself too? Share the task details directly.
            </Text>
            <View style={styles.shareRow}>
              <Pressable style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={18} color={colors.primary} />
                <Text style={styles.shareBtnText}>Share…</Text>
              </Pressable>
            </View>

            <Button title={isNew ? 'Create Task' : 'Save Changes'} onPress={handleSave} loading={loading} style={styles.submit} />
          </>
        ) : (
          <>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Title</Text>
              <Text style={styles.readOnlyValue}>{title}</Text>
            </View>
            {description ? (
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Notes</Text>
                <Text style={styles.readOnlyValue}>{description}</Text>
              </View>
            ) : null}
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Due</Text>
              <Text style={styles.readOnlyValue}>{date}{time ? ` at ${time}` : ''}</Text>
            </View>
          </>
        )}

        {!isNew ? (
          <Pressable style={styles.completeRow} onPress={handleToggleComplete}>
            <DoneToggle done={!!reminder?.is_completed} />
            <Text style={styles.completeText}>{reminder?.is_completed ? 'Completed' : 'Mark as done'}</Text>
          </Pressable>
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
  pickerHint: {
    ...typography.bodyMuted,
    marginBottom: spacing.md,
  },
  shareHint: {
    ...typography.caption,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  shareRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  shareBtnText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  submit: {
    marginTop: spacing.md,
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
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
