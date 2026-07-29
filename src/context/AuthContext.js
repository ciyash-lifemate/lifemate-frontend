import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { getToken, saveToken, clearToken, getMe, registerDeviceToken, unregisterDeviceToken } from '../api/index.js';
import { getExpoPushToken } from '../utils/notifications.js';
import { cancelAllLocalReminders } from '../utils/localReminders.js';

const AuthContext = createContext(null);

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
          setUser(await getMe());
          syncPushToken();
        } catch {
          await clearToken();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = useCallback(async (token, sessionUser) => {
    await saveToken(token);
    setUser(sessionUser);
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
    await clearToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    setUser(await getMe());
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
          
                     