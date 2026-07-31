import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Android notification channels are immutable once created - if this app's
// channel was ever created before `sound` was set here (an earlier test
// build, or Android auto-creating it on first notification), later changes
// to its sound/importance are silently ignored. Bumping the id forces
// Android to create a fresh channel with the current config instead of
// reusing whatever "default" already locked in on-device.
//
// One channel per sound, not one shared channel: Android can only ever play
// whichever sound a channel was created with, so offering a choice between
// several sounds means that many channels, all always created - the user's
// pick (see settings module) just decides which one a given notification is
// sent through, in src/utils/localReminders.js (local) and push.js on the
// backend (server, must stay in sync with channelIdFor there).
//
// 'default'/'alert' keep their original v3 channel ids from before this
// picker grew past two options - an already-installed app's device has
// already locked those in, so renaming them would silently orphan its
// existing channels instead of just adding to them. Everything added after
// that lives under a new v4 id instead.
export const SOUND_CATALOG = [
  { id: 'default', label: 'Default', file: null },
  { id: 'alert', label: 'Alert Tone', file: 'reminder_alert.wav' },
  { id: 'bell', label: 'Bell', file: 'sound_bell.mp3' },
  { id: 'bells', label: 'Happy Bells', file: 'sound_bells.mp3' },
  { id: 'pop', label: 'Pop', file: 'sound_pop.mp3' },
  { id: 'confirm', label: 'Confirm', file: 'sound_confirm.mp3' },
  { id: 'positive', label: 'Positive', file: 'sound_positive.mp3' },
  { id: 'doorbell', label: 'Doorbell', file: 'sound_doorbell.mp3' },
  { id: 'digital', label: 'Digital', file: 'sound_digital.mp3' },
  { id: 'magic', label: 'Magic Ring', file: 'sound_magic.mp3' },
  { id: 'clear', label: 'Clear Tone', file: 'sound_clear.mp3' },
  { id: 'urgent', label: 'Urgent', file: 'sound_urgent.mp3' },
];

export const CHANNEL_IDS = Object.fromEntries(
  SOUND_CATALOG.map(({ id }) => [
    id,
    id === 'default' || id === 'alert' ? `reminders-v3-${id}` : `reminders-v4-${id}`,
  ])
);

const SOUND_PREF_KEY = 'notification_sound_pref';

// Cached locally so scheduling a local notification never has to make a
// network round-trip just to know which channel to use - notification-
// settings.js writes this the moment the user changes their pick, and the
// startup settings fetch (see app/notification-settings.js) seeds it too.
export const setPreferredSound = (value) => AsyncStorage.setItem(SOUND_PREF_KEY, value).catch(() => {});

export const getPreferredChannelId = async () => {
  try {
    const pref = await AsyncStorage.getItem(SOUND_PREF_KEY);
    return CHANNEL_IDS[pref] || CHANNEL_IDS.default;
  } catch {
    return CHANNEL_IDS.default;
  }
};

// Since SDK 53, expo-notifications throws the moment it's *imported* when
// running inside Expo Go on Android (a side-effect file it re-exports
// registers a push-token listener at module-load time, which throws
// "removed from Expo Go, use a development build"). A guard placed after a
// static `import` can't prevent that - the import itself already crashed by
// then. So it's never statically imported here; `require()` is only called,
// lazily, once we already know the environment can support it.
const isSupported = !(
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient
);

// Whether this environment can actually receive a push/local notification at
// all (false in Expo Go on Android). Exported so a foreground-only fallback
// (see ReminderAlertWatcher) can stand down once real push is available.
export const isNotificationsSupported = () => isSupported;

let cachedModule = null;
const getNotifications = () => {
  if (!isSupported) return null;
  if (!cachedModule) {
    cachedModule = require('expo-notifications');
    cachedModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return cachedModule;
};

// Guards requestPermissionsAsync so it only ever shows the OS prompt once
// per app session (granted or not), no matter how many times
// setupNotifications() itself is called. LocalReminderSync calls this on
// every AppState 'active' transition - on a fresh install, before the
// prompt has been answered, showing that system dialog itself pauses/
// resumes the host Activity, which flips AppState back to 'active' and
// re-triggered this same call, which requested permission (and so showed
// the dialog) again - a tight pause/resume/re-request loop that made the
// screen flicker and eventually got the app killed. Deliberately never
// reset back to false (not even in a `finally`) - once asked, later calls
// only ever re-check the already-answered status via getPermissionsAsync()
// (a plain read, no dialog), they don't ask again this session.
let permissionRequested = false;

// Call once when the app starts. Safe to call more than once.
export const setupNotifications = async () => {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    if (Platform.OS === 'android') {
      // Filenames must match what's bundled via the expo-notifications
      // config plugin in app.json's "sounds" array - underscore, not a
      // hyphen: Android rejects a raw resource name with a dash in it
      // (learned the hard way, see the EAS prebuild failure that caused).
      for (const { id, label, file } of SOUND_CATALOG) {
        await Notifications.setNotificationChannelAsync(CHANNEL_IDS[id], {
          name: id === 'default' ? 'Reminders' : `Reminders (${label})`,
          importance: Notifications.AndroidImportance.MAX,
          sound: file || 'default',
        });
      }
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    if (permissionRequested) return false;
    permissionRequested = true;
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return status === 'granted';
  } catch {
    return false;
  }
};

// The device's Expo push token, for registering with the backend so it can
// send reminder push notifications. Returns null wherever push isn't
// available (Expo Go on Android, no permission, no EAS project id
// configured, etc.) - callers already treat a falsy result as "skip it".
export const getExpoPushToken = async () => {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch (e) {
    if (__DEV__) console.warn('[push] getExpoPushTokenAsync failed:', e?.message);
    return null;
  }
};

// Fires the moment a push arrives while the app is in the foreground (before
// the user taps it, if ever) - used to speak the reminder's title out loud
// alongside the notification's own sound. Background/killed-app pushes can't
// trigger this (or any JS) at all, so voice announcement is foreground-only,
// same limitation as the sound fallback in ReminderAlertWatcher.
export const subscribeToNotificationReceived = (handler) => {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    handler(notification.request.content.data);
  });
  return () => subscription.remove();
};

// Fires when the user taps a notification (foreground, background, or from
// a killed app's tray) - a server push (see notifyReminderDue on the
// backend) or an on-device local notification (see src/utils/localReminders.js)
// both land here identically. `handler` receives the notification's `data`
// object, e.g. { type: 'reminder', reminderId, reminderType } - this is
// purely about deep-linking a tap to the right screen.
// Returns an unsubscribe function; a no-op where notifications aren't supported.
export const subscribeToNotificationTaps = (handler) => {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response.notification.request.content.data);
  });
  return () => subscription.remove();
};
