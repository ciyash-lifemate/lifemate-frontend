import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

const CHANNEL_ID = 'default';

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

// Call once when the app starts. Safe to call more than once.
export const setupNotifications = async () => {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
      });
    }
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return status === 'granted';
  } catch {
    return false;
  }
};

// The device's Expo push token, for registering with the backend so it can
// send reminder/chat push notifications. Returns null wherever push isn't
// available (Expo Go on Android, no permission, no EAS project id
// configured, etc.) - callers already treat a falsy result as "skip it".
export const getExpoPushToken = async () => {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return data;
  } catch {
    return null;
  }
};

// Fires when the user taps a notification (foreground, background, or from
// a killed app's tray). `handler` receives the push payload's `data` object,
// e.g. { type: 'reminder', reminderId, reminderType } or { type: 'chat', chatId }
// - reminder due-alerts are sent by the backend's scheduler now, not scheduled
// on-device, so this is purely about deep-linking a tap to the right screen.
// Returns an unsubscribe function; a no-op where notifications aren't supported.
export const subscribeToNotificationTaps = (handler) => {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response.notification.request.content.data);
  });
  return () => subscription.remove();
};
