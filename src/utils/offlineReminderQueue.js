import AsyncStorage from '@react-native-async-storage/async-storage';
import { createReminder, getErrorMessage } from '../api/index.js';
import { scheduleDraftReminder, cancelDraftReminder } from './localReminders.js';

const QUEUE_KEY = 'offline_reminder_queue';

const loadQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveQueue = (queue) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)).catch(() => {});

const makeTempId = () => `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// createReminder's payload is camelCase (see app/reminders/[type].js); the
// trigger/content builders in localReminders.js expect the server's
// snake_case row shape (that's what listReminders returns) - translate just
// the fields a draft alert actually needs.
const toDraftRow = (tempId, payload) => ({
  id: tempId,
  type: payload.type,
  title: payload.title,
  description: payload.description,
  reminder_date: payload.reminderDate,
  reminder_time: payload.reminderTime,
  repeat_type: payload.repeatType,
  recipient_mobile: payload.recipientMobile,
  wish_message: payload.wishMessage,
  voice_message: payload.voiceMessage,
});

// Called when createReminder fails with a network error (no internet to
// reach the backend at all). Schedules the on-device alert immediately from
// the form's own values, so it still fires on time, and remembers the
// request to replay once connectivity is back (see syncQueuedReminders).
export const queueOfflineReminder = async (payload) => {
  const tempId = makeTempId();
  await scheduleDraftReminder(tempId, toDraftRow(tempId, payload));
  const queue = await loadQueue();
  queue.push({ tempId, payload });
  await saveQueue(queue);
  return tempId;
};

// Replays every queued offline reminder against the backend, in order.
// Stops at the first network failure (assume still offline, leave the rest
// queued for next time) but drops requests the backend itself rejects
// (e.g. stale/invalid data by the time it's replayed) since retrying those
// can never succeed. Caller is responsible for calling resyncLocalReminders
// afterwards to pick up the real server ids for whatever synced.
export const syncQueuedReminders = async (userId) => {
  const queue = await loadQueue();
  if (!queue.length) return;

  const remaining = [];
  let stillOffline = false;

  for (const item of queue) {
    if (stillOffline) {
      remaining.push(item);
      continue;
    }
    try {
      await createReminder(item.payload);
      await cancelDraftReminder(item.tempId);
    } catch (err) {
      if (err?.response) {
        await cancelDraftReminder(item.tempId);
        if (__DEV__) console.warn('[offline-queue] dropped rejected reminder:', getErrorMessage(err));
      } else {
        stillOffline = true;
        remaining.push(item);
      }
    }
  }

  await saveQueue(remaining);
};

export const clearOfflineReminderQueue = () => AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
