import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, saveToken, clearToken, getMe, registerDeviceToken, unregisterDeviceToken } from '../api/index.js';
import { getExpoPushToken } from '../utils/notifications.js';
import { cancelAllLocalReminders } from '../utils/localReminders.js';
import { clearOfflineReminderQueue } from '../utils/offlineReminderQueue.js';
import { clearOfflineCompleteQueue } from '../utils/offlineCompleteQueue.js';

const AuthContext = createContext(null);

// Last-known profile, so a signed-in user who opens the app with no
// connectivity still lands on Home instead of being bounced to login just
// because getMe() couldn't be reached - see the startup effect below.
const CACHED_USER_KEY = 'lifemate_cached_user';
const cacheUser = (u) => AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(u)).catch(() => {});

// Best-effort: registers this device for push notifications. Silently
// does nothing wherever a push token isn't available (Expo Go on Android, no
// permission, etc.) - see src/utils/notifications.js.

const syncPushToken = async () => {
  try {
    const token = await getExpoPushToken();
    if (!token) {
      if (__DEV__) console.warn('[push] no Expo push token available - device will not receive push notifications');
      return;
    }
    await registerDeviceToken(token, Platform.OS);
    if (__DEV__) console.log('[push] device token registered:', token.slice(0, 25) + '…');
  } catch (e) {
    // Best-effort only - a failed registration shouldn't block sign-in.
    if (__DEV__) console.warn('[push] registerDeviceToken failed:', e?.message);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const me = await getMe();
          setUser(me);
          cacheUser(me);
          syncPushToken();
        } catch (err) {
          if (err?.response?.status === 401) {
            // The backend itself rejected this token - it's genuinely invalid.
            await clearToken();
            await AsyncStorage.removeItem(CACHED_USER_KEY).catch(() => {});
          } else {
            // getMe() couldn't be reached at all (offline, DNS, timeout) -
            // that says nothing about whether the token is still valid, so
            // don't sign the user out over it. Fall back to the last-known
            // profile so the app is still usable with no connectivity.
            try {
              const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
              if (raw) setUser(JSON.parse(raw));
            } catch {
              // No cached profile either - falls through to the login screens.
            }
          }
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (token, sessionUser) => {
    await saveToken(token);
    setUser(sessionUser);
    cacheUser(sessionUser);
    syncPushToken();
  }, []);

  const signOut = useCallback(async () => {
    // Unregister the push token while the JWT is still valid - clearing the
    // token first would make this call unauthorized.
    try {
      const pushToken = await getExpoPushToken();
      if (pushToken) await unregisterDeviceToken(pushToken, Platform.OS);
    } catch {
      // Best-effort only.
    }
    // So a different account signing into the same device never inherits
    // this account's on-device reminder alerts (see src/utils/localReminders.js).
    await cancelAllLocalReminders();
    await clearOfflineReminderQueue();
    await clearOfflineCompleteQueue();
    await clearToken();
    await AsyncStorage.removeItem(CACHED_USER_KEY).catch(() => {});
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await getMe();
    setUser(me);
    cacheUser(me);
  }, []);

  // signIn/signOut/refreshUser/setUser are already stable (useCallback with
  // no deps, or useState's own setter) - memoized so this object's identity
  // only changes when user/isLoading actually do, instead of on every
  // AuthProvider render. Without this, every consumer of useAuth() anywhere
  // in the tree (BottomNavBar, NotificationTapRouter, every screen) re-renders
  // whenever AuthProvider re-renders for any reason, not just a real auth change.
  const value = useMemo(
    () => ({ user, isLoading, signIn, signOut, refreshUser, setUser }),
    [user, isLoading, signIn, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
          
                     