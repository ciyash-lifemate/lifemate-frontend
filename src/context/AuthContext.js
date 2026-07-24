import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { getToken, saveToken, clearToken, getMe, registerDeviceToken, unregisterDeviceToken } from '../api/index.js';
import { connectSocket, disconnectSocket } from '../api/socket.js';
import { getExpoPushToken } from '../utils/notifications.js';

const AuthContext = createContext(null);

// Best-effort: registers this device for chat push notifications. Silently
// does nothing wherever a push token isn't available (Expo Go on Android, no
// permission, etc.) - see src/utils/notifications.js.
const syncPushToken = async () => {
  try {
    const token = await getExpoPushToken();
    if (token) await registerDeviceToken(token, Platform.OS);
  } catch {
    // Best-effort only - a failed registration shouldn't block sign-in.
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
          connectSocket();
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
    connectSocket();
    syncPushToken();
  }, []);

  const signOut = useCallback(async () => {
    // Unregister the push token and drop the socket while the JWT is still
    // valid - clearing the token first would make both calls unauthorized.
    try {
      const pushToken = await getExpoPushToken();
      if (pushToken) await unregisterDeviceToken(pushToken, Platform.OS);
    } catch {
      // Best-effort only.
    }
    disconnectSocket();
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
