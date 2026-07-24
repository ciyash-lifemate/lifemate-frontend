import { io } from 'socket.io-client';
import { API_BASE_URL, getToken } from './index.js';

// The REST client's baseURL is .../api/v1/user, but Socket.IO connects to the
// server's root origin, not a REST path.
const SOCKET_URL = API_BASE_URL.replace(/\/api\/v1\/user\/?$/, '');

// A single socket for the whole app session, owned by AuthContext (connected
// on sign-in / app boot with an existing session, disconnected on sign-out).
// Screens only add/remove their own listeners on top of it - they never
// connect or disconnect it themselves, so navigating between chat screens
// never touches the connection.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  // A function (not a static object) so the current token is re-read from
  // SecureStore on every (re)connect attempt, not just the first one.
  auth: (cb) => {
    getToken().then((token) => cb({ token }));
  },
});

if (__DEV__) {
  socket.on('connect', () => console.log('[socket] connected'));
  socket.on('disconnect', (reason) => console.log('[socket] disconnected:', reason));
  socket.on('connect_error', (err) => console.log('[socket] connect_error:', err.message));
}

export const connectSocket = () => {
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = () => {
  socket.disconnect();
};
