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
import { ChecklistEditor } from '../../src/components/ChecklistEditor.js';
import { Button } from '../../src/components/Button.js';
import { VoiceFormFillButton } from '../../src/components/VoiceFormFillButton.js';
import { createReminder, getReminder, updateReminder, deleteReminder, getErrorMessage } from '../../src/api/index.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { openWhatsAppWish, buildWishMessage } from '../../src/utils/whatsapp.js';
import { parseReminderVoice } from '../../src/utils/parseReminderVoice.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

// One tap away from Send (see src/utils/whatsapp.js for why it can't be
// fully automatic). "Best Wishes" is included verbatim per the requested list.
const WISH_OPTIONS = [
  { value: 'Happy Birthday! Wishing you a fantastic day full of joy. 🎂', label: 'Happy Birthday! 🎂' },
  { value: 'Best Wishes! 🎁', label: 'Best Wishes' },
  { value: 'Wishing you a wonderful birthday and a fantastic year ahead! 🎉', label: 'Wonderful Year Ahead' },
  { value: 'Happy Birthday! May all your dreams come true. ✨', label: 'Dreams Come True' },
  { value: 'Wishing you joy, health and happiness today and always! 💐', label: 'Joy & Happiness' },
  { value: 'Many happy returns of the day! 🎈', label: 'Many Happy Returns' },
  { value: 'Happy Birthday! Stay blessed and keep smiling. 🙏', label: 'Stay Blessed' },
  { value: 'Happy Birthday! Hope your day is as amazing as you are. 🥳', label: 'As Amazing As You' },
];

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
    hasChecklist: true,
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
    hasWish: true,
    hasChecklist: true,
    repeatOptions: YEARLY_REPEAT_OPTIONS,
    defaultRepeat: 'yearly',
  },
  anniversary: {
    heading: 'Anniversary Reminder',
    nameLabel: 'Occasion Name',
    namePlaceholder: 'Wedding Anniversary',
    hasDosage: false,
    hasTime: true,
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
    heading: 'Others Reminder',
    nameLabel: 'Title',
    namePlaceholder: 'Water the plants',
    hasDosage: false,
    hasTime: true,
    hasDate: true,
    hasChecklist: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'none',
  },
  event: {
    heading: 'Event / Meeting',
    nameLabel: 'Event / Meeting Title',
    namePlaceholder: 'Team Standup',
    hasDosage: false,
    hasTime: true,
    hasDate: true,
    hasChecklist: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'none',
  },
  recharge: {
    heading: 'Recharge Reminder',
    nameLabel: 'Recharge For',
    namePlaceholder: 'Mobile Recharge',
    hasDosage: false,
    hasTime: true,
    hasDate: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'monthly',
  },
  alarm: {
    heading: 'Alarm',
    nameLabel: 'Alarm Label',
    namePlaceholder: 'Wake up',
    hasDosage: false,
    hasTime: true,
    hasDate: false,
    hasChecklist: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'daily',
  },
};

export default function ReminderForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { type, id, date: paramDate } = useLocalSearchParams();
  const config = TYPE_CONFIG[type];
  const typeStyle = reminderTypeStyles[type] || reminderTypeStyles.custom;

  const [title, setTitle] = useState('');
  const [dosage, setDosage] = useState('');
  // Pre-filled when opened from Calendar's "+" on a selected day; overwritten
  // below by the fetched reminder's own date when editing an existing one.
  const [date, setDate] = useState(paramDate || '');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState(config?.defaultRepeat || 'none');
  const [notes, setNotes] = useState('');
  const [recipientMobile, setRecipientMobile] = useState('');
  const [wishMessage, setWishMessage] = useState(WISH_OPTIONS[0].value);
  const [checklistItems, setChecklistItems] = useState(() => (config?.hasChecklist ? [{ text: '', done: false }] : []));
  const [voiceMessage, setVoiceMessage] = useState('');
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
        setRecipientMobile(reminder.recipient_mobile || '');
        setWishMessage(reminder.wish_message || WISH_OPTIONS[0].value);
        setChecklistItems(reminder.checklist_items?.length ? reminder.checklist_items : [{ text: '', done: false }]);
        setVoiceMessage(reminder.voice_message || '');
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
      ...(config.hasWish
        ? { recipientMobile: recipientMobile.trim() || undefined, wishMessage: wishMessage || undefined }
        : {}),
      ...(config.hasChecklist
        ? {
            checklistItems: checklistItems
              .filter((item) => item.text.trim())
              .map((item) => ({ text: item.text.trim(), done: !!item.done })),
          }
        : {}),
      voiceMessage: voiceMessage.trim() || undefined,
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
      Alert.alert('Could not save reminder', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceFill = (transcript) => {
    const parsed = parseReminderVoice(transcript);
    if (parsed.title) setTitle(parsed.title);
    if (config.hasDate && parsed.date) setDate(parsed.date);
    if (config.hasTime && parsed.time) setTime(parsed.time);
  };

  const handleSendWishNow = () => {
    if (!recipientMobile.trim()) {
      Alert.alert('Mobile number required', "Add the person's WhatsApp number first.");
      return;
    }
    const message = buildWishMessage(title.trim(), wishMessage, user?.name);
    openWhatsAppWish(recipientMobile, message);
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

        <VoiceFormFillButton
          onResult={handleVoiceFill}
          label={`Fill with voice, e.g. "${config.namePlaceholder} tomorrow at 5pm"`}
        />

        <TextField
          label={config.nameLabel}
          placeholder={config.namePlaceholder}
          value={title}
          onChangeText={setTitle}
          voiceInput
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
          voiceInput
        />

        <TextField
          label="Voice Reminder Message (optional)"
          placeholder="What should we say out loud when this is due?"
          value={voiceMessage}
          onChangeText={setVoiceMessage}
          multiline
          style={styles.notesInput}
          voiceInput
        />
        <Text style={styles.voiceHint}>
          Read aloud automatically once the reminder's alert sound finishes - falls back to the title above if left
          blank.
        </Text>

        {config.hasChecklist ? (
          <ChecklistEditor label="Agenda / Checklist" items={checklistItems} onChange={setChecklistItems} />
        ) : null}

        {config.hasWish ? (
          <>
            <TextField
              label="WhatsApp number (optional)"
              placeholder="+91 98765 43210"
              value={recipientMobile}
              onChangeText={setRecipientMobile}
              keyboardType="phone-pad"
            />
            <SelectField label="Wish message" value={wishMessage} options={WISH_OPTIONS} onChange={setWishMessage} />
            {recipientMobile.trim() ? (
              <Pressable style={styles.whatsappBtn} onPress={handleSendWishNow}>
                <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
                <Text style={styles.whatsappBtnText}>Send this wish via WhatsApp now</Text>
              </Pressable>
            ) : null}
            <Text style={styles.wishHint}>
              At the reminder time you'll get a notification - tapping it opens WhatsApp with this message ready to
              send. WhatsApp doesn't allow sending without you tapping Send yourself.
            </Text>
          </>
        ) : null}

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
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  whatsappBtnText: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
  },
  wishHint: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  voiceHint: {
    ...typography.caption,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
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
