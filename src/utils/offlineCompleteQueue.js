import AsyncStorage from '@react-native-async-storage/async-storage';
import { completeReminder } from '../api/index.js';

const QUEUE_KEY = 'offline_complete_queue';

const loadQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveQueue = (queue) => AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)).catch(() => {});

// Keyed by reminder id, not appended - toggling the same reminder several
// times while offline (done -> undone -> done) should only ever replay its
// *latest* desired state when connectivity returns, not every intermediate
// flip.
export const queueOfflineComplete = async (id, isCompleted) => {
  const queue = await loadQueue();
  queue[id] = isCompleted;
  await saveQueue(queue);
};

// Replays every queued completion toggle against the backend. A queued
// entry that fails with a network error is left for the next sync attempt;
// one the server itself rejects (e.g. the reminder was deleted meanwhile)
// is dropped, since retrying it can never succeed.
export const syncQueuedCompletions = async () => {
  const queue = await loadQueue();
  const ids = Object.keys(queue);
  if (!ids.length) return;

  const remaining = { ...queue };
  for (const id of ids) {
    try {
      await completeReminder(id, queue[id]);
      delete remaining[id];
    } catch (err) {
      if (err?.response) delete remaining[id];
    }
  }
  await saveQueue(remaining);
};

export const clearOfflineCompleteQueue = () => AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
