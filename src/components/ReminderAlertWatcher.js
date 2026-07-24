import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { listTodayReminders } from '../api/index.js';
import { isNotificationsSupported } from '../utils/notifications.js';
import { useAuth } from '../context/AuthContext.js';

// Foreground-only fallback for reminder sound, for Expo Go on Android where
// expo-notifications (and so the backend's real push) can't reach the device
// at all (see src/utils/notifications.js). While the app is open, this polls
// today's reminders and plays a short alert sound + popup when one comes due.
// Standing down once real push is available (a dev/production build) avoids
// double-alerting the same reminder.
const POLL_MS = 20000;
const DUE_WINDOW_SECONDS = 60; // catch a reminder within a minute of its time

const toTodayDate = (timeValue) => {
  if (!timeValue) return null;
  const [h, m, s] = timeValue.slice(0, 8).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date();
  d.setHours(h, m, s || 0, 0);
  return d;
};

export const ReminderAlertWatcher = () => {
  const { user } = useAuth();
  const player = useAudioPlayer(require('../../assets/reminder-alert.wav'));
  const alertedIdsRef = useRef(new Set());
  const lastDateRef = useRef(new Date().toDateString());
  const intervalRef = useRef(null);

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
            await player.seekTo(0);
            player.play();
            Alert.alert(reminder.title || 'Reminder', "It's time!");
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
      if (state === 'active') startPolling();
      else stopPolling();
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [user, player]);

  return null;
};
