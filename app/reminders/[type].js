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
import { ChecklistEditor } from '../../src/components/ChecklistEditor.js';
import { RecipientPicker } from '../../src/components/RecipientPicker.js';
import { Button } from '../../src/components/Button.js';
import { VoiceFormFillButton } from '../../src/components/VoiceFormFillButton.js';
import { createReminder, getReminder, updateReminder, deleteReminder, getErrorMessage } from '../../src/api/index.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { parseReminderVoice } from '../../src/utils/parseReminderVoice.js';
import { resyncLocalReminders } from '../../src/utils/localReminders.js';
import { queueOfflineReminder } from '../../src/utils/offlineReminderQueue.js';
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

// Plain-text summary for the generic "let someone know outside the app"
// options (WhatsApp one-tap send, or the phone's own Share sheet) - every
// Quick Add type gets these now, not just birthday's canned wish messages.
const buildShareMessage = (title, description, date, time) => {
  const when = time ? `${date} at ${time}` : date;
  return `${title}${description ? `\n${description}` : ''}\nWhen: ${when}`;
};

// reminder_date is NOT NULL on the backend for every type, but the mockup
// only surfaces a date field for types where the date is meaningful to pick
// (birthday/anniversary/task/custom). Medicine reminders silently anchor to
// today, matching the "Medicine Name / Time(s) / Repeat / Notes" form.
const TYPE_CONFIG = {
  medicine: {
    heading: 'Medicine Reminder',
    nameLabel: 'Medicine Name',
    namePlaceholder: 'Paracetamol',
    hasTime: true,
    hasDate: false,
    hasRecipients: true,
    // Same medicine, several doses a day (8am, 1pm, 4pm...) - each becomes
    // its own independent, separately-completable reminder rather than one
    // row trying to represent multiple times (see handleSave).
    hasMultipleTimes: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'daily',
  },
  birthday: {
    heading: 'Birthday Reminder',
    nameLabel: "Person's Name",
    namePlaceholder: 'Mom',
    hasTime: true,
    hasDate: true,
    hasWish: true,
    hasChecklist: true,
    hasRecipients: true,
    repeatOptions: YEARLY_REPEAT_OPTIONS,
    defaultRepeat: 'yearly',
  },
  anniversary: {
    heading: 'Anniversary Reminder',
    nameLabel: 'Occasion Name',
    namePlaceholder: 'Wedding Anniversary',
    hasTime: true,
    hasDate: true,
    hasRecipients: true,
    repeatOptions: YEARLY_REPEAT_OPTIONS,
    defaultRepeat: 'yearly',
  },
  task: {
    heading: 'Task Reminder',
    nameLabel: 'Task Title',
    namePlaceholder: 'Submit report',
    hasTime: true,
    hasDate: true,
    hasRecipients: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'none',
  },
  custom: {
    heading: 'Others Reminder',
    nameLabel: 'Title',
    namePlaceholder: 'Water the plants',
    hasTime: true,
    hasDate: true,
    hasChecklist: true,
    hasRecipients: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'none',
  },
  event: {
    heading: 'Event / Meeting',
    nameLabel: 'Event / Meeting Title',
    namePlaceholder: 'Team Standup',
    hasTime: true,
    hasDate: true,
    hasChecklist: true,
    checklistLabel: 'Agenda',
    hasRecipients: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'none',
  },
  recharge: {
    heading: 'Recharge Reminder',
    nameLabel: 'Recharge For',
    namePlaceholder: 'Mobile Recharge',
    hasTime: true,
    hasDate: true,
    hasRecipients: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'monthly',
  },
  alarm: {
    heading: 'Alarm',
    nameLabel: 'Alarm Label',
    namePlaceholder: 'Wake up',
    hasTime: true,
    hasDate: false,
    // Just an alarm - label, time, repeat. None of the reminder-form extras
    // (notes, voice message, checklist, recipients, share) apply to it.
    minimal: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'daily',
  },
  company: {
    heading: 'Company Reminder',
    nameLabel: 'Company Name',
    namePlaceholder: 'Acme Pvt Ltd',
    notesLabel: 'Task',
    notesPlaceholder: 'Follow up on invoice',
    hasTime: true,
    hasDate: true,
    hasRecipients: true,
    // Business, not personal Quick Add - a company/team can easily be
    // bigger than the 5-person cap the picker defaults to (see
    // RecipientPicker.js), so this is the one type here that gets no limit.
    unlimitedRecipients: true,
    repeatOptions: REPEAT_OPTIONS,
    defaultRepeat: 'none',
  },
};

export default function ReminderForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { type, id, date: paramDate } = useLocalSearchParams();
  const config = TYPE_CONFIG[type];
  const typeStyle = reminderTypeStyles[type] || reminderTypeStyles.custom;

  const [title, setTitle] = useState('');
  // Pre-filled when opened from Calendar's "+" on a selected day; overwritten
  // below by the fetched reminder's own date when editing an existing one.
  const [date, setDate] = useState(paramDate || '');
  const [time, setTime] = useState('');
  // Extra dose times for hasMultipleTimes types (medicine) - each becomes
  // its own separate reminder on save, alongside the primary `time` above.
  // Always starts empty, even when editing - the existing reminder being
  // edited is still just the one row for `time`; anything added here
  // creates new sibling reminders rather than trying to represent several
  // times on a single row.
  const [extraTimes, setExtraTimes] = useState([]);
  const [repeat, setRepeat] = useState(config?.defaultRepeat || 'none');
  const [notes, setNotes] = useState('');
  const [wishMessage, setWishMessage] = useState(WISH_OPTIONS[0].value);
  const [checklistItems, setChecklistItems] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!!id);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const reminder = await getReminder(id);
        setTitle(reminder.title || '');
        setDate(reminder.reminder_date || '');
        setTime((reminder.reminder_time || '').slice(0, 5));
        setRepeat(reminder.repeat_type || config?.defaultRepeat || 'none');
        setNotes(reminder.description || '');
        setWishMessage(reminder.wish_message || WISH_OPTIONS[0].value);
        setChecklistItems(reminder.checklist_items || []);
        setRecipients(reminder.recipients || []);
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
    if (config.hasMultipleTimes && extraTimes.some((t) => !t)) {
      Alert.alert('Time required', 'Please set a time for each additional dose, or remove it.');
      return;
    }

    const basePayload = {
      type,
      title: title.trim(),
      repeatType: repeat,
      description: notes.trim() || undefined,
      reminderDate: config.hasDate ? date : todayIso(),
      ...(config.hasWish ? { wishMessage: wishMessage || undefined } : {}),
      ...(config.hasChecklist
        ? {
            checklistItems: checklistItems
              .filter((item) => item.text.trim())
              .map((item) => ({ text: item.text.trim(), done: !!item.done })),
          }
        : {}),
      ...(config.hasRecipients ? { recipientUserIds: recipients.map((r) => r.id) } : {}),
    };
    // A separate call per dose time - Medicine's several-times-a-day case
    // needs several independently completable reminders, not one row
    // trying to hold multiple times.
    const withTime = (reminderTime) => (config.hasTime ? { ...basePayload, reminderTime } : basePayload);

    setLoading(true);
    try {
      if (id) {
        await updateReminder(id, withTime(time));
        if (config.hasMultipleTimes) {
          for (const extraTime of extraTimes) {
            await createReminder(withTime(extraTime));
          }
        }
      } else {
        const payloads = [withTime(time), ...(config.hasMultipleTimes ? extraTimes.map(withTime) : [])];
        let failedAt = -1;
        try {
          for (let i = 0; i < payloads.length; i += 1) {
            failedAt = i;
            await createReminder(payloads[i]);
          }
          failedAt = -1;
        } catch (err) {
          if (err?.response) throw err; // a real validation error - surface it below
          // No internet at all - keep whatever hasn't been created yet on-device
          // (see src/utils/offlineReminderQueue.js) so it still alerts on time,
          // and replay it to the backend on the next successful foreground sync.
          for (const payload of payloads.slice(failedAt)) {
            await queueOfflineReminder(payload);
          }
          resyncLocalReminders(user?.id);
          router.back();
          Alert.alert(
            'Saved on your device',
            "No internet right now, so this reminder will still alert you on time. It'll sync to your account once you're back online."
          );
          return;
        }
      }
      // Best-effort, fire-and-forget - keeps the on-device alert (see
      // src/utils/localReminders.js) in sync immediately instead of waiting
      // for the next app-foreground resync. Not awaited so a slow/offline
      // resync never delays navigating back.
      resyncLocalReminders(user?.id);
      router.back();
    } catch (err) {
      Alert.alert('Could not save reminder', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const addExtraTime = () => setExtraTimes((prev) => [...prev, '']);
  const updateExtraTime = (index, value) =>
    setExtraTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  const removeExtraTime = (index) => setExtraTimes((prev) => prev.filter((_, i) => i !== index));

  const handleVoiceFill = (transcript) => {
    const parsed = parseReminderVoice(transcript);
    if (parsed.title) setTitle(parsed.title);
    if (config.hasDate && parsed.date) setDate(parsed.date);
    if (config.hasTime && parsed.time) setTime(parsed.time);
  };

  const handleShare = async () => {
    if (!title.trim() && !notes.trim()) {
      Alert.alert('Nothing to share', `Please enter a ${config.nameLabel.toLowerCase()} or notes first.`);
      return;
    }
    try {
      await Share.share({
        message: buildShareMessage(title.trim(), notes.trim(), config.hasDate ? date : todayIso(), config.hasTime ? time : ''),
      });
    } catch {
      // Best-effort - the share sheet itself already surfaces its own errors.
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
            resyncLocalReminders(user?.id);
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

        {config.hasDate ? <DateField label="Date" value={date} onChange={setDate} mode="date" /> : null}
        {config.hasTime ? <DateField label="Time" value={time} onChange={setTime} mode="time" /> : null}

        {config.hasMultipleTimes ? (
          <>
            {extraTimes.map((extraTime, index) => (
              <View key={index} style={styles.extraTimeRow}>
                <View style={styles.extraTimeField}>
                  <DateField
                    label={`Dose ${index + 2} Time`}
                    value={extraTime}
                    onChange={(value) => updateExtraTime(index, value)}
                    mode="time"
                  />
                </View>
                <Pressable onPress={() => removeExtraTime(index)} hitSlop={10} style={styles.removeTimeBtn}>
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={addExtraTime} style={styles.addTimeBtn}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addTimeText}>Add another time today</Text>
            </Pressable>
          </>
        ) : null}

        <SelectField label="Repeat" value={repeat} options={config.repeatOptions} onChange={setRepeat} />

        {!config.minimal ? (
          <>
            <TextField
              label={config.notesLabel || 'Notes (optional)'}
              placeholder={config.notesPlaceholder || 'After food'}
              value={notes}
              onChangeText={setNotes}
              multiline
              style={styles.notesInput}
              voiceInput
            />
          </>
        ) : null}

        {config.hasChecklist ? (
          <ChecklistEditor label={config.checklistLabel || 'Checklist'} items={checklistItems} onChange={setChecklistItems} />
        ) : null}

        {config.hasRecipients ? (
          <RecipientPicker
            value={recipients}
            onChange={setRecipients}
            maxRecipients={config.unlimitedRecipients ? Infinity : undefined}
          />
        ) : null}

        {config.hasWish ? (
          <SelectField label="Wish message" value={wishMessage} options={WISH_OPTIONS} onChange={setWishMessage} />
        ) : null}

        {!config.minimal ? (
          <>
            <Text style={styles.shareHint}>
              Let someone know outside the app too - Share it via WhatsApp, SMS, email, or anywhere else.
            </Text>
            <View style={styles.shareRow}>
              <Pressable style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={18} color={colors.primary} />
                <Text style={styles.shareBtnText}>Share…</Text>
              </Pressable>
            </View>
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
  extraTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  extraTimeField: {
    flex: 1,
  },
  removeTimeBtn: {
    marginBottom: spacing.md,
  },
  addTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  addTimeText: {
    ...typography.bodyMuted,
    color: colors.primary,
    fontWeight: '600',
  },
  shareHint: {
    ...typography.caption,
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
