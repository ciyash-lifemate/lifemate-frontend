import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { TextField } from '../../src/components/TextField.js';
import { DateField } from '../../src/components/DateField.js';
import { RecipientPicker } from '../../src/components/RecipientPicker.js';
import { Button } from '../../src/components/Button.js';
import {
  createReminder,
  getReminder,
  updateReminder,
  deleteReminder,
  getErrorMessage,
} from '../../src/api/index.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { resyncLocalReminders } from '../../src/utils/localReminders.js';
import { formatClockTime } from '../../src/utils/date.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatMsgTime = (value) => {
  if (!value) return '';
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatClockTime(d);
};

const formatMsgDate = (value) => {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// One labeled row inside the message/people cards below.
const InfoRow = ({ icon, label, value, last }) => (
  <View style={[styles.infoRow, last && styles.infoRowLast]}>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={16} color={colors.primary} />
    </View>
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

export default function BusinessNoteDetail() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const typeStyle = reminderTypeStyles.note;

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [selfReminder, setSelfReminder] = useState(true);
  const [reminder, setReminder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!isNew);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const data = await getReminder(id);
        setReminder(data);
        setTitle(data.title || '');
        setMessage(data.description || '');
        setDate(data.reminder_date || '');
        setTime((data.reminder_time || '').slice(0, 5));
        setRecipients(data.recipients || []);
        setSelfReminder(data.self_reminder !== false);
      } catch {
        Alert.alert('Could not load message', 'Please try again.');
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [id, isNew]);

  const isOwner = isNew || String(reminder?.user_id) === String(user?.id);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Heading required', 'Please enter a heading.');
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

    const payload = {
      type: 'note',
      title: title.trim(),
      description: message.trim() || undefined,
      reminderDate: date,
      reminderTime: time,
      recipientUserIds: recipients.map((r) => r.id),
      // Only meaningful once someone else is on the list - always true
      // otherwise, since with no recipients you're the only one being
      // reminded at all.
      selfReminder: recipients.length ? selfReminder : true,
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
      Alert.alert('Could not save message', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete message', `Delete "${title}"?`, [
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
            Alert.alert('Could not delete message', getErrorMessage(err));
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
          !isNew && isOwner ? (
            <Pressable onPress={handleDelete} hitSlop={12} disabled={deleting}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{isNew ? 'New Message' : title}</Text>

        <View style={[styles.iconCircle, { backgroundColor: typeStyle.bg }]}>
          <MaterialCommunityIcons name={typeStyle.icon} size={36} color={typeStyle.color} />
        </View>

        {isOwner ? (
          <>
            <TextField label="Heading" placeholder="Follow up on invoice" value={title} onChangeText={setTitle} voiceInput />
            <TextField
              label="Description (optional)"
              placeholder="What's this message about?"
              value={message}
              onChangeText={setMessage}
              multiline
              style={styles.messageInput}
              voiceInput
            />
            <DateField label="Date" value={date} onChange={setDate} mode="date" />
            <DateField label="Time" value={time} onChange={setTime} mode="time" />

            <RecipientPicker label="Send to" value={recipients} onChange={setRecipients} />

            {recipients.length ? (
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Remind me too</Text>
                  <Text style={styles.toggleHint}>
                    You're sharing this with others - turn this off if you don't want it on your own phone too.
                  </Text>
                </View>
                <Switch value={selfReminder} onValueChange={setSelfReminder} />
              </View>
            ) : null}

            <Button title={isNew ? 'Create Message' : 'Save Changes'} onPress={handleSave} loading={loading} style={styles.submit} />
          </>
        ) : (
          <>
            <View style={styles.reminderBanner}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.primaryDark} />
              <Text style={styles.reminderBannerText}>This is a reminder message. You'll get notified when it's time.</Text>
            </View>

            <View style={styles.messageBubble}>
              <View style={styles.messageBubbleHeader}>
                <View style={styles.messageBubbleIconWrap}>
                  <Ionicons name="chatbubble" size={14} color={colors.white} />
                </View>
                <Text style={styles.messageBubbleHeaderText}>Reminder</Text>
              </View>
              <Text style={styles.messageBubbleTitle}>{title}</Text>
              {message ? <Text style={styles.messageBubbleBody}>{message}</Text> : null}

              <View style={styles.messageDivider} />

              <InfoRow icon="calendar-outline" label="Date" value={formatMsgDate(date)} />
              <InfoRow icon="time-outline" label="Time" value={time ? formatMsgTime(time) : 'Any time'} last={!message} />
            </View>

            <View style={styles.peopleCard}>
              <InfoRow icon="person-outline" label="Shared by" value={reminder?.creator_name || 'Someone'} />
              <InfoRow
                icon="people-outline"
                label="Sent to"
                value={recipients.length > 1 ? `You and ${recipients.length - 1} other${recipients.length - 1 > 1 ? 's' : ''}` : 'You'}
                last
              />
            </View>
          </>
        )}
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
  messageInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toggleLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  toggleHint: {
    ...typography.caption,
    marginTop: 2,
  },
  submit: {
    marginTop: spacing.md,
  },
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  reminderBannerText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
  },
  messageBubble: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  messageBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  messageBubbleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubbleHeaderText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageBubbleTitle: {
    ...typography.h3,
  },
  messageBubbleBody: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  messageDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginVertical: spacing.md,
  },
  peopleCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoRowLast: {
    paddingBottom: 0,
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
    justifyContent: 'center',
  },
  infoLabel: {
    ...typography.caption,
  },
  infoValue: {
    ...typography.body,
    fontWeight: '600',
    marginTop: 1,
  },
});
