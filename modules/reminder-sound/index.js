import { requireNativeModule } from 'expo-modules-core';

// requireNativeModule() throws immediately, at call time, if the native side
// isn't compiled into the running binary - not lazily on first use. A
// top-level call here would crash the *entire app* the moment anything
// imports this file (transitively, notification-settings.js does), on any
// build that predates this native module (an already-installed old APK,
// Expo Go, or a dev server without a fresh prebuild) - long before the user
// ever taps "Choose Sound from Phone". Deferred to first actual use instead,
// same lazy-require pattern src/utils/notifications.js already uses for
// expo-notifications and for the exact same reason.
let cachedModule;
const getModule = () => {
  if (cachedModule === undefined) {
    try {
      cachedModule = requireNativeModule('ReminderSound');
    } catch {
      cachedModule = null;
    }
  }
  return cachedModule;
};

const requireModule = () => {
  const mod = getModule();
  if (!mod) {
    throw new Error(
      'Picking a sound from your phone needs a newer app build - this install does not have that feature yet.'
    );
  }
  return mod;
};

export const takePersistableUriPermission = (uri) => requireModule().takePersistableUriPermission(uri);

export const setChannelSound = (channelId, channelName, uri) =>
  requireModule().setChannelSound(channelId, channelName, uri);
