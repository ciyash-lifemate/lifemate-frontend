import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { TextField } from '../../src/components/TextField.js';
import { DateField } from '../../src/components/DateField.js';
import { SelectField } from '../../src/components/SelectField.js';
import { Button } from '../../src/components/Button.js';
import { createReminder, getReminder, updateReminder, deleteReminder } from '../../src/api/index.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

// Backend repeat_type enum: none | daily | weekly | monthly | yearly.
const REPEAT_OPTIONS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const YEARLY_REPEAT_OPTIONS = [
  { value: 'yearly', label: 'Yearly' },
  { value: 'none', label: 'Once' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

// reminder_date is NOT NULL on the backend for every type, but the mockup
// only surfaces a date field for types where the date is meaningful to pick
// (birthday/anniversary/task/custom). Medicine reminders silently anchor to
// today, matching the "Medicine Name / Dosage / Time / Repeat / Notes" form.
const TYPE_CONFIG = {
  medicine: {
    heading: 'Medicine Reminder',
    nameLabel: 'Medicine Name',
    namePlaceholder: 'Paracetamol',
    hasDosage: true,
    hasTime: true,
    hasDate: false,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'daily',
  },
  birthday: {
    heading: 'Birthday Reminder',
    nameLabel: "Person's Name",
    namePlaceholder: 'Mom',
    hasDosage: false,
    hasTime: true,
    hasDate: true,
    repeatOptions: YEARLY_REPEAT_OPTIONS,
    defaultRepeat: 'yearly',
  },
  anniversary: {
    heading: 'Anniversary Reminder',
    nameLabel: 'Occasion Name',
    namePlaceholder: 'Wedding Anniversary',
    hasDosage: false,
    hasTime: false,
    hasDate: true,
    repeatOptions: YEARLY_REPEAT_OPTIONS,
    defaultRepeat: 'yearly',
  },
  task: {
    heading: 'Task Reminder',
    nameLabel: 'Task Title',
    namePlaceholder: 'Submit report',
    hasDosage: false,
    hasTime: true,
    hasDate: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'none',
  },
  custom: {
    heading: 'Custom Reminder',
    nameLabel: 'Title',
    namePlaceholder: 'Water the plants',
    hasDosage: false,
    hasTime: true,
    hasDate: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'none',
  },
};

export default function ReminderForm() {
  const router = useRouter();
  const { type, id } = useLocalSearchParams();
  const config = TYPE_CONFIG[type];
  const typeStyle = reminderTypeStyles[type] || reminderTypeStyles.custom;

  const [title, setTitle] = useState('');
  const [dosage, setDosage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState(config?.defaultRepeat || 'none');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const reminder = await getReminder(id);
        setTitle(reminder.title || '');
        setDosage(reminder.dosage || '');
        setDate(reminder.reminder_date || '');
        setTime((reminder.reminder_time || '').slice(0, 5));
        setRepeat(reminder.repeat_type || config?.defaultRepeat || 'none');
        setNotes(reminder.description || '');
      } catch {
        // Fall back to a blank form if the reminder can't be fetched.
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [id]);

  if (!config) {
    return (
      <ScreenContainer>
        <Header title="" />
        <Text style={styles.notFound}>Unknown reminder type.</Text>
      </ScreenContainer>
    );
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', `Please enter a ${config.nameLabel.toLowerCase()}.`);
      return;
    }
    if (config.hasDate && !date) {
      Alert.alert('Date required', 'Please select a date.');
      return;
    }
    if (config.hasTime && !time) {
      Alert.alert('Time required', 'Please select a time.');
      return;
    }

    const payload = {
      type,
      title: title.trim(),
      repeatType: repeat,
      description: notes.trim() || undefined,
      reminderDate: config.hasDate ? date : todayIso(),
      ...(config.hasTime ? { reminderTime: time } : {}),
      ...(config.hasDosage ? { dosage: dosage.trim() || undefined } : {}),
    };

    setLoading(true);
    try {
      // The backend's scheduler fires the due-reminder push itself - nothing
      // to schedule on-device here.
      if (id) {
        await updateReminder(id, payload);
      } else {
        await createReminder(payload);
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not save reminder', err.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete reminder', `Delete "${title || config.heading}"?`, [
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
            Alert.alert('Could not delete reminder', err.response?.data?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loadingExisting) {
    return (
      <ScreenContainer>
        <Header title="" />
        <Text style={styles.notFound}>Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title=""
        right={
          id ? (
            <Pressable onPress={handleDelete} hitSlop={12} disabled={deleting}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{config.heading}</Text>

        <View style={[styles.iconCircle, { backgroundColor: typeStyle.bg }]}>
          <MaterialCommunityIcons name={typeStyle.icon} size={36} color={typeStyle.color} />
        </View>

        <TextField
          label={config.nameLabel}
          placeholder={config.namePlaceholder}
          value={title}
          onChangeText={setTitle}
        />

        {config.hasDosage ? (
          <TextField label="Dosage" placeholder="500 mg" value={dosage} onChangeText={setDosage} />
        ) : null}

        {config.hasDate ? <DateField label="Date" value={date} onChange={setDate} mode="date" /> : null}
        {config.hasTime ? <DateField label="Time" value={time} onChange={setTime} mode="time" /> : null}

        <SelectField label="Repeat" value={repeat} options={config.repeatOptions} onChange={setRepeat} />

        <TextField
          label="Notes (optional)"
          placeholder="After food"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={styles.notesInput}
        />

        <Button title="Save Reminder" onPress={handleSave} loading={loading} style={styles.submit} />
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
  submit: {
    marginTop: spacing.md,
  },
  notFound: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
