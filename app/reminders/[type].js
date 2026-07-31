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
import { formatClockTime } from '../../src/utils/date.js';
import { openWhatsAppWish, buildWishMessage } from '../../src/utils/whatsapp.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

const REPEAT_LABELS = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

// reminder_time is a bare "HH:mm:ss" and reminder_date a bare "YYYY-MM-DD" -
// anchoring/splitting by hand like this (rather than new Date(dateString))
// keeps both read as local wall-clock values, not shifted by the parser
// treating a dateless/zoneless string as UTC.
const formatReminderTime = (value) => {
  if (!value) return '';
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatClockTime(d);
};

const formatReminderDate = (value) => {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

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

// One labeled row in the read-only detail view (see the `viewMode` branch
// below) - `last` drops the divider so the final row in the card doesn't
// end in a stray line.
const ViewInfoRow = ({ icon, label, value, last }) => (
  <View style={[styles.viewInfoRow, last && styles.viewInfoRowLast]}>
    <View style={styles.viewInfoIconWrap}>
      <Ionicons name={icon} size={18} color={colors.primary} />
    </View>
    <View style={styles.viewInfoText}>
      <Text style={styles.viewInfoLabel}>{label}</Text>
      <Text style={styles.viewInfoValue}>{value}</Text>
    </View>
  </View>
);

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
  const [loadedReminder, setLoadedReminder] = useState(null);
  // Starts false (form) - only flipped to true once the fetched reminder
  // says the viewer isn't its owner. A new reminder (!id) never has a
  // reminder to be a non-owner of, so this stays false for the create flow.
  const [viewMode, setViewMode] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const reminder = await getReminder(id);
        setLoadedReminder(reminder);
        // A reminder shared with someone (the common "also remind" picker
        // case, not a Family edit-permission member) lands here with
        // can_manage: false - they used to be dropped straight into this
        // same editable form (with a working Save/Delete that would just
        // 403 if they tried), which read as "why can I edit someone else's
        // reminder" and was confusing either way. Anyone who *can* manage it
        // still reaches the form, just via the read-only view's own Edit
        // button now instead of automatically.
        setViewMode(String(reminder.user_id) !== String(user?.id));
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

  if (loadedReminder && viewMode) {
    const r = loadedReminder;
    const otherRecipients = r.recipients || [];
    const sharedWithText =
      otherRecipients.length > 1
        ? `You and ${otherRecipients.length - 1} other${otherRecipients.length - 1 > 1 ? 's' : ''}`
        : otherRecipients.length === 1
          ? 'Just you'
          : null;

    return (
      <ScreenContainer>
        <Header title="" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heading}>{config.heading}</Text>

          <View style={styles.viewCard}>
            <View style={styles.viewCardHeader}>
              <View style={[styles.iconCircleSm, { backgroundColor: typeStyle.bg }]}>
                <MaterialCommunityIcons name={typeStyle.icon} size={28} color={typeStyle.color} />
              </View>
              <View style={styles.viewCardHeaderText}>
                <Text style={styles.viewTitle}>{r.title}</Text>
                <Text style={styles.viewSubtitle}>
                  {config.heading.replace(' Reminder', '')} • {REPEAT_LABELS[r.repeat_type] || 'Once'}
                </Text>
              </View>
            </View>

            <View style={styles.viewHighlightRow}>
              <View style={styles.viewHighlightItem}>
                <Ionicons name="calendar-outline" size={16} color={colors.primaryDark} />
                <Text style={styles.viewHighlightText}>{formatReminderDate(r.reminder_date)}</Text>
              </View>
              {r.reminder_time ? (
                <View style={styles.viewHighlightItem}>
                  <Ionicons name="time-outline" size={16} color={colors.primaryDark} />
                  <Text style={styles.viewHighlightText}>{formatReminderTime(r.reminder_time)}</Text>
                </View>
              ) : null}
            </View>

            <ViewInfoRow icon="person-outline" label="Reminder created by" value={r.creator_name || 'Someone'} />
            <ViewInfoRow icon="repeat-outline" label="Repeat" value={REPEAT_LABELS[r.repeat_type] || 'Once'} />
            {r.description ? <ViewInfoRow icon="document-text-outline" label="Notes" value={r.description} /> : null}
            {sharedWithText ? <ViewInfoRow icon="people-outline" label="Shared with" value={sharedWithText} last /> : null}
            {config.hasWish && r.wish_message ? (
              <ViewInfoRow icon="chatbubble-outline" label="Wish message" value={r.wish_message} last />
            ) : null}
          </View>

          {String(r.user_id) !== String(user?.id) ? (
            <View style={styles.sharedBanner}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <View style={styles.sharedBannerText}>
                <Text style={styles.sharedBannerTitle}>This is a shared reminder</Text>
                <Text style={styles.sharedBannerBody}>
                  {r.creator_name || 'Someone'} created this reminder and shared it with you. You'll get notified
                  when it's time.
                </Text>
              </View>
            </View>
          ) : null}

          {config.hasWish && r.recipient_mobile ? (
            <View style={styles.wishCard}>
              <View style={styles.wishCardText}>
                <Text style={styles.wishCardTitle}>Send wishes</Text>
                <Text style={styles.wishCardSubtitle}>Send a wish to {r.title}</Text>
              </View>
              <Pressable
                style={styles.whatsappBtn}
                onPress={() =>
                  openWhatsAppWish(r.recipient_mobile, buildWishMessage(r.title, r.wish_message, user?.name))
                }
              >
                <Ionicons name="logo-whatsapp" size={16} color={colors.success} />
                <Text style={styles.whatsappBtnText}>Send via WhatsApp</Text>
              </Pressable>
            </View>
          ) : null}

          {r.can_manage ? (
            <View style={styles.viewActionsRow}>
              <Pressable style={styles.viewEditBtn} onPress={() => setViewMode(false)}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={styles.viewEditBtnText}>Edit Reminder</Text>
              </Pressable>
              <Pressable style={styles.viewDeleteBtn} onPress={handleDelete} disabled={deleting}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={styles.viewDeleteBtnText}>Delete Reminder</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
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
  viewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  viewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  iconCircleSm: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewCardHeaderText: {
    flex: 1,
  },
  viewTitle: {
    ...typography.h2,
  },
  viewSubtitle: {
    ...typography.bodyMuted,
    marginTop: 2,
  },
  viewHighlightRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  viewHighlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  viewHighlightText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  viewInfoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  viewInfoRowLast: {
    borderBottomWidth: 0,
  },
  viewInfoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewInfoText: {
    flex: 1,
  },
  viewInfoLabel: {
    ...typography.caption,
  },
  viewInfoValue: {
    ...typography.body,
    fontWeight: '600',
    marginTop: 2,
  },
  sharedBanner: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sharedBannerText: {
    flex: 1,
  },
  sharedBannerTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  sharedBannerBody: {
    ...typography.caption,
    marginTop: 2,
  },
  wishCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  wishCardText: {
    flex: 1,
  },
  wishCardTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  wishCardSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  whatsappBtnText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '700',
  },
  viewActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  viewEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  viewEditBtnText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  viewDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#FCE9E9',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  viewDeleteBtnText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '700',
  },
});
