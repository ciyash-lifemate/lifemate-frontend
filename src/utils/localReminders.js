import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isNotificationsSupported, getPreferredChannelId } from './notifications.js';
import { listReminders } from '../api/index.js';

// Same lazy require() as notifications.js - expo-notifications throws the
// moment it's imported (not just used) inside Expo Go on Android, so it's
// only ever required here after isNotificationsSupported() already
// confirmed the runtime can support it. require() returns the same cached
// module instance notifications.js already configured (setNotificationHandler
// etc.), so there's nothing to re-initialize here.
const getNotifications = () => (isNotificationsSupported() ? require('expo-notifications') : null);

const STORAGE_KEY = 'local_reminder_schedule';

// Mirrors reminders.scheduler.js's EMOJI_BY_TYPE/buildAlertCopy on the
// backend, so a locally-fired reminder looks identical to a server-pushed one.
const EMOJI_BY_TYPE = {
  medicine: '💊',
  birthday: '🎂',
  anniversary: '💍',
  task: '✅',
  custom: '📌',
  event: '📅',
  alarm: '⏰',
  recharge: '📱',
  company: '🏢',
};

const buildContent = (reminder) => {
  const emoji = EMOJI_BY_TYPE[reminder.type] || '⏰';
  const body =
    reminder.type === 'medicine' && reminder.dosage
      ? `Time to take: ${reminder.dosage}`
      : reminder.description || 'Reminder time!';
  return {
    title: `${emoji} ${reminder.title}`,
    body,
    sound: 'default',
    // Same shape the backend's push already sends (see notifyReminderDue in
    // notifications.service.js) - this is what lets the existing tap-router
    // and speak-aloud handlers in app/_layout.js work identically whether
    // the alert was local or server-pushed, with no changes needed there.
    data: {
      type: 'reminder',
      reminderId: reminder.id,
      reminderType: reminder.type,
      recipientName: reminder.title,
      recipientMobile: reminder.recipient_mobile,
      wishMessage: reminder.wish_message,
      voiceMessage: reminder.voice_message,
      projectId: reminder.project_id,
    },
  };
};

const pad = (n) => String(n).padStart(2, '0');

// Maps this reminder's date/time/repeat to an expo-notifications trigger.
// Returns null when there's nothing to schedule (a one-off reminder whose
// moment has already passed). Dates/times are parsed as local wall-clock
// (no "Z" suffix) so the trigger fires at the phone's own local time,
// matching what the reminder form actually showed the user.
const buildTrigger = (reminder, Notifications, channelId) => {
  const { SchedulableTriggerInputTypes: Types } = Notifications;
  const [hour, minute] = (reminder.reminder_time || '00:00').slice(0, 5).split(':').map(Number);

  if (reminder.repeat_type === 'daily') {
    return { type: Types.DAILY, hour, minute, channelId };
  }

  if (reminder.repeat_type === 'weekly') {
    // JS Date.getDay(): 0=Sunday..6=Saturday. expo-notifications WEEKLY
    // weekday: 1=Sunday..7=Saturday - one-based, not zero-based.
    const weekday = new Date(`${reminder.reminder_date}T00:00:00`).getDay() + 1;
    return { type: Types.WEEKLY, weekday, hour, minute, channelId };
  }

  if (reminder.repeat_type === 'monthly') {
    const day = new Date(`${reminder.reminder_date}T00:00:00`).getDate();
    // MONTHLY is Android-only; iOS needs a repeating CALENDAR trigger instead.
    if (Platform.OS === 'android') return { type: Types.MONTHLY, day, hour, minute, channelId };
    return { type: Types.CALENDAR, day, hour, minute, repeats: true };
  }

  if (reminder.repeat_type === 'yearly') {
    const parsed = new Date(`${reminder.reminder_date}T00:00:00`);
    const day = parsed.getDate();
    const month = parsed.getMonth(); // 0-indexed, matches expo-notifications
    // YEARLY is Android-only; iOS needs a repeating CALENDAR trigger instead.
    if (Platform.OS === 'android') return { type: Types.YEARLY, day, month, hour, minute, channelId };
    return { type: Types.CALENDAR, day, month, hour, minute, repeats: true };
  }

  // 'none' - one-shot at the exact date+time, skip if it's already passed
  // (e.g. an old reminder being re-synced) since there's nothing to fire.
  const fireDate = new Date(`${reminder.reminder_date}T${pad(hour)}:${pad(minute)}:00`);
  if (Number.isNaN(fireDate.getTime()) || fireDate.getTime() <= Date.now()) return null;
  return { type: Types.DATE, date: fireDate, channelId };
};

const loadMap = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveMap = (map) => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map)).catch(() => {});

// Schedules the on-device alert for a reminder that hasn't reached the
// backend yet (see src/utils/offlineReminderQueue.js) - same trigger/content
// building as the synced path, just keyed under `draft:<tempId>` in the same
// map instead of a real server id, so cancelDraftReminder can find it again
// once the queued create finally succeeds.
export const scheduleDraftReminder = async (tempId, draftRow) => {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  const channelId = await getPreferredChannelId();
  const trigger = buildTrigger(draftRow, Notifications, channelId);
  if (!trigger) return false;
  try {
    const notifId = await Notifications.scheduleNotificationAsync({ content: buildContent(draftRow), trigger });
    const map = await loadMap();
    map[`draft:${tempId}`] = notifId;
    await saveMap(map);
    return true;
  } catch {
    return false;
  }
};

// Cancels the on-device alert scheduled by scheduleDraftReminder - called
// once the queued create either reaches the backend (resyncLocalReminders
// then reschedules it under the real server id) or is dropped as
// unrecoverable.
export const cancelDraftReminder = async (tempId) => {
  const Notifications = getNotifications();
  const map = await loadMap();
  const key = `draft:${tempId}`;
  if (!map[key]) return;
  if (Notifications) await Notifications.cancelScheduledNotificationAsync(map[key]).catch(() => {});
  delete map[key];
  await saveMap(map);
};

// Cancels every reminder this app has locally scheduled and forgets them -
// called on sign-out so a second account signing into the same device never
// inherits the first account's on-device alerts.
export const cancelAllLocalReminders = async () => {
  const Notifications = getNotifications();
  const map = await loadMap();
  if (Notifications) {
    await Promise.all(
      Object.values(map).map((notifId) => Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {}))
    );
  }
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
};

// The one function everything else calls: re-derives the on-device schedule
// from the server's current reminder list. Always cancels and re-schedules
// every active reminder rather than diffing against a stored signature -
// cheap at personal-reminder scale and simpler to reason about correctly.
//
// `userId` is the signed-in user's own id (every call site already has it
// via useAuth()) - needed to tell "my own reminder" apart from "a Project
// Task I created but delegated to someone else" (shouldn't also ring on my
// own phone) and "a reminder I shared but turned self_reminder off for"
// (Business Notes' "remind me too" toggle) - see the filter below.
//
// Scoped to reminders where group_id is null - Group reminders already have
// their own notification pipeline (immediate assign push + due-date push +
// the creator's self-reminder toggle); folding local scheduling into that
// needs to also honor creator_self_reminder, which is a separate follow-up
// rather than being bundled in here.
// Guards against two overlapping calls both loading the same map before
// either has saved it back - this is called from several places with no
// coordination between them (LocalReminderSync on every AppState 'active',
// the notification-received handler in app/_layout.js, and every reminder
// save/delete screen). Without this, two calls landing close together could
// each see the same reminder as "not yet scheduled under a known id" and
// both call scheduleNotificationAsync for it - that's two real, independent
// OS-level alarms, and only one of them ends up recorded in the map (saved
// by whichever call finishes last), so the other becomes untracked and
// un-cancellable. Both alarms still fire at the due time, which is what
// showed up as the same reminder alerting more than once.
let inFlightResync = null;

export const resyncLocalReminders = async (userId) => {
  if (inFlightResync) return inFlightResync;

  inFlightResync = (async () => {
    const Notifications = getNotifications();
    if (!Notifications) return;

    let items;
    try {
      // 100 is the API's max pageSize (see reminders.validation.js) - the
      // largest single page it allows.
      ({ items } = await listReminders({ pageSize: 100 }));
    } catch {
      return; // offline or logged out - leave whatever's already scheduled alone
    }

    const isOwner = (r) => String(r.user_id) === String(userId);
    const active = (items || []).filter(
      (r) =>
        !r.group_id &&
        !r.is_completed &&
        !(r.project_id && isOwner(r)) && // delegated away - the assignee gets the alarm, not me
        !(isOwner(r) && r.self_reminder === false) // I explicitly opted out of my own copy
    );
    const map = await loadMap();
    const keepIds = new Set();
    const channelId = await getPreferredChannelId();

    for (const reminder of active) {
      const trigger = buildTrigger(reminder, Notifications, channelId);
      if (!trigger) continue;
      const key = String(reminder.id);
      keepIds.add(key);
      if (map[key]) {
        await Notifications.cancelScheduledNotificationAsync(map[key]).catch(() => {});
      }
      try {
        map[key] = await Notifications.scheduleNotificationAsync({ content: buildContent(reminder), trigger });
      } catch {
        delete map[key];
      }
    }

    await Promise.all(
      Object.keys(map)
        .filter((key) => !keepIds.has(key))
        .map(async (key) => {
          await Notifications.cancelScheduledNotificationAsync(map[key]).catch(() => {});
          delete map[key];
        })
    );

    await saveMap(map);
  })();

  try {
    await inFlightResync;
  } finally {
    inFlightResync = null;
  }
};
