import { io } from 'socket.io-client';
import { API_BASE_URL, getToken } from './index.js';

// The REST client's baseURL is .../api/v1/user, but Socket.IO connects to the
// server's root origin, not a REST path.
const SOCKET_URL = API_BASE_URL.replace(/\/api\/v1\/user\/?$/, '');

const noop = () => {};
// A dead-socket shape: every screen calls socket.on/off/emit unconditionally
// in useEffects, so this needs to satisfy that shape without doing anything.
const createFallbackSocket = () => ({
  connected: false,
  connect: noop,
  disconnect: noop,
  on: noop,
  off: noop,
  emit: noop,
  timeout: () => ({ emit: noop }),
});

// io(...) constructs the Manager/Socket synchronously at import time. This
// import chain runs on every app boot (AuthContext -> socket.js, imported
// from the root layout) before login, so a construction-time throw here
// would crash the whole app before any screen ever renders - same failure
// class as the expo-notifications Android/Expo-Go bug. Falling back to a
// no-op socket keeps the app usable (chat just won't be real-time) instead.
let socketInstance;
try {
  socketInstance = io(SOCKET_URL, {
    autoConnect: false,
    // A function (not a static object) so the current token is re-read from
    // SecureStore on every (re)connect attempt, not just the first one.
    auth: (cb) => {
      getToken().then((token) => cb({ token }));
    },
  });
  if (__DEV__) {
    socketInstance.on('connect', () => console.log('[socket] connected'));
    socketInstance.on('disconnect', (reason) => console.log('[socket] disconnected:', reason));
    socketInstance.on('connect_error', (err) => console.log('[socket] connect_error:', err.message));
  }
} catch (e) {
  if (__DEV__) console.warn('[socket] failed to initialize socket.io-client:', e?.message);
  socketInstance = createFallbackSocket();
}

export const socket = socketInstance;

export const connectSocket = () => {
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = () => {
  socket.disconnect();
};
