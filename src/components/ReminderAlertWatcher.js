import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import { listTodayReminders, completeReminder, deleteReminder } from '../api/index.js';
import { isNotificationsSupported } from '../utils/notifications.js';
import { speakReminder } from '../utils/speech.js';
import { useAuth } from '../context/AuthContext.js';
import { ReminderDetailModal } from './ReminderDetailModal.js';

// Foreground-only fallback for reminder sound, for Expo Go on Android where
// expo-notifications (and so the backend's real push) can't reach the device
// at all (see src/utils/notifications.js). While the app is open, this polls
// today's reminders and plays a short alert sound + detail card when one
// comes due. Standing down once real push is available (a dev/production
// build) avoids double-alerting the same reminder.
const POLL_MS = 5000;
const DUE_WINDOW_SECONDS = 60; // catch a reminder within a minute of its time

const toTodayDate = (timeValue) => {
  if (!timeValue) return null;
  const [h, m, s] = timeValue.slice(0, 8).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date();
  d.setHours(h, m, s || 0, 0);
  return d;
};

// Speaks `text` the instant the alert sound actually finishes, rather than
// firing speech and sound at the same time - waits for the player's own
// "didJustFinish" event instead of guessing at the WAV's duration.
const speakAfterSound = (audioPlayer, text) => {
  const subscription = audioPlayer.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) {
      subscription.remove();
      speakReminder(text);
    }
  });
};

export const ReminderAlertWatcher = () => {
  const router = useRouter();
  const { user } = useAuth();
  const player = useAudioPlayer(require('../../assets/reminder_alert.wav'));
  const alertedIdsRef = useRef(new Set());
  const lastDateRef = useRef(new Date().toDateString());
  const intervalRef = useRef(null);
  // The due reminder currently shown in the detail card - only one at a
  // time, since the modal can only show one reminder anyway.
  const [dueReminder, setDueReminder] = useState(null);

  useEffect(() => {
    if (!user || isNotificationsSupported()) return undefined;

    const checkDueReminders = async () => {
      const todayStr = new Date().toDateString();
      if (todayStr !== lastDateRef.current) {
        lastDateRef.current = todayStr;
        alertedIdsRef.current.clear();
      }

      try {
        const data = await listTodayReminders();
        const reminders = Array.isArray(data) ? data : data?.items || [];
        const now = new Date();

        for (const reminder of reminders) {
          if (reminder.is_completed || alertedIdsRef.current.has(reminder.id)) continue;
          const due = toTodayDate(reminder.reminder_time);
          if (!due) continue;
          const secondsSinceDue = (now - due) / 1000;
          if (secondsSinceDue >= 0 && secondsSinceDue <= DUE_WINDOW_SECONDS) {
            alertedIdsRef.current.add(reminder.id);
            const speakText = reminder.voice_message || reminder.title;
            if (speakText) speakAfterSound(player, speakText);
            await player.seekTo(0);
            player.play();
            setDueReminder(reminder);
          }
        }
      } catch {
        // Best-effort - skip this poll on any failure, try again next tick.
      }
    };

    const startPolling = () => {
      checkDueReminders();
      intervalRef.current = setInterval(checkDueReminders, POLL_MS);
    };
    const stopPolling = () => clearInterval(intervalRef.current);

    if (AppState.currentState === 'active') startPolling();
    const subscription = AppState.addEventListener('change', (state) => {
      // stopPolling() first even on 'active' - AppState can fire 'change' with
      // 'active' more than once without an intervening background state, and
      // without this, each redundant call would overwrite intervalRef with a
      // new interval while leaking the previous one, which then keeps polling
      // forever with no way to ever clear it again.
      stopPolling();
      if (state === 'active') startPolling();
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [user, player]);

  const handleToggle = async (reminder) => {
    setDueReminder(null);
    try {
      await completeReminder(reminder.id, true);
    } catch {
      // Best-effort - the reminder just stays open, user can retry from its
      // own screen (Home/Calendar/History) which all show live state.
    }
  };

  const handleEdit = (reminder) => {
    setDueReminder(null);
    router.push({ pathname: `/reminders/${reminder.type}`, params: { id: reminder.id } });
  };

  const handleDelete = (reminder) => {
    Alert.alert('Delete reminder', `Delete "${reminder.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDueReminder(null);
          try {
            await deleteReminder(reminder.id);
          } catch {
            // Best-effort, same as above.
          }
        },
      },
    ]);
  };

  return (
    <ReminderDetailModal
      visible={!!dueReminder}
      reminder={dueReminder}
      onClose={() => setDueReminder(null)}
      onToggle={handleToggle}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
};
