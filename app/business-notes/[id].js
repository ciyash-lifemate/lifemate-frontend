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
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

const todayIso = () => new Date().toISOString().slice(0, 10);

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
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>Heading</Text>
              <Text style={styles.readOnlyValue}>{title}</Text>
            </View>
            {message ? (
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyLabel}>Description</Text>
                <Text style={styles.readOnlyValue}>{message}</Text>
              </View>
            ) : null}
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyLabel}>When</Text>
              <Text style={styles.readOnlyValue}>{date}{time ? ` at ${time}` : ''}</Text>
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
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
