import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'lifemate_token';

// Android emulator can't reach "localhost" on the host machine - it needs the
// special 10.0.2.2 alias. iOS simulator and web can use localhost directly.
// For a physical device, set EXPO_PUBLIC_API_URL to your machine's LAN IP,
// e.g. http://192.168.1.20:5000/api/v1/user
const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${defaultHost}:5000/api/v1/user`;
console.log('[api] API_BASE_URL =', API_BASE_URL);

export const client = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const saveToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);

const unwrap = (promise) => promise.then((res) => res.data.data);

// --- auth ---

export const sendOtp = (mobile) => unwrap(client.post('/auth/otp/send', { mobile }));
export const verifyOtp = (mobile, otp) => unwrap(client.post('/auth/otp/verify', { mobile, otp }));
export const googleLogin = (idToken) => unwrap(client.post('/auth/google', { idToken }));
export const getMe = () => unwrap(client.get('/auth/me'));
export const updateMe = (payload) => unwrap(client.put('/auth/me', payload));
export const searchUsers = (q) => unwrap(client.get('/auth/search', { params: { q } }));

// --- dashboard ---

export const getDashboard = () => unwrap(client.get('/dashboard'));

// --- reminders ---

export const listReminders = (params) => unwrap(client.get('/reminders', { params }));
export const listTodayReminders = () => unwrap(client.get('/reminders/today'));
export const listCalendarReminders = (from, to) =>
  unwrap(client.get('/reminders/calendar', { params: { from, to } }));
export const getReminder = (id) => unwrap(client.get(`/reminders/${id}`));
export const createReminder = (payload) => unwrap(client.post('/reminders', payload));
export const updateReminder = (id, payload) => unwrap(client.put(`/reminders/${id}`, payload));
export const completeReminder = (id, isCompleted) =>
  unwrap(client.patch(`/reminders/${id}/complete`, { isCompleted }));
export const deleteReminder = (id) => unwrap(client.delete(`/reminders/${id}`));

// --- notes ---

export const listNotes = (search) => unwrap(client.get('/notes', { params: { search } }));
export const getNote = (id) => unwrap(client.get(`/notes/${id}`));
export const createNote = (payload) => unwrap(client.post('/notes', payload));
export const updateNote = (id, payload) => unwrap(client.put(`/notes/${id}`, payload));
export const deleteNote = (id) => unwrap(client.delete(`/notes/${id}`));

// --- notifications ---

export const listNotifications = (type) => unwrap(client.get('/notifications', { params: { type } }));
export const getUnreadNotificationCount = () => unwrap(client.get('/notifications/unread-count'));
export const markNotificationRead = (id) => unwrap(client.patch(`/notifications/${id}/read`));
export const markAllNotificationsRead = () => unwrap(client.patch('/notifications/read-all'));

// --- chats ---

export const listChats = () => unwrap(client.get('/chats'));
export const startChat = (userId) => unwrap(client.post('/chats', { userId }));
export const listMessages = (chatId, before) =>
  unwrap(client.get(`/chats/${chatId}/messages`, { params: { before, limit: 50 } }));
// payload carries messageType/media fields for media sends, not just plain text -
// see MESSAGE_TYPES in src/utils/chat.js for the accepted messageType values.
export const sendMessage = (chatId, payload) => unwrap(client.post(`/chats/${chatId}/messages`, payload));
export const editMessage = (chatId, messageId, content) =>
  unwrap(client.patch(`/chats/${chatId}/messages/${messageId}`, { content }));
export const deleteMessage = (chatId, messageId) =>
  unwrap(client.delete(`/chats/${chatId}/messages/${messageId}`));
export const markChatRead = (chatId) => unwrap(client.patch(`/chats/${chatId}/read`));
export const pinChat = (chatId, isPinned) => unwrap(client.patch(`/chats/${chatId}/pin`, { isPinned }));

// Upload BEFORE sending an image/video/audio/document message - the returned
// `url` becomes the message's mediaUrl. Never send raw file bytes over the socket.
export const uploadFile = (file) => {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name || 'upload', type: file.mime || 'application/octet-stream' });
  return unwrap(
    client.post('/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // uploads can be up to 50MB, well beyond the client's default 15s
    })
  );
};

export const registerDeviceToken = (token, platform) =>
  unwrap(client.post('/notifications/device-token', { token, platform }));
export const unregisterDeviceToken = (token, platform) =>
  unwrap(client.delete('/notifications/device-token', { data: { token, platform } }));

// --- calls ---
// The call itself is signaled entirely over Socket.IO (call:invite/answer/
// ice-candidate/reject/end) - this is just the call history log.
export const listCallHistory = () => unwrap(client.get('/calls'));

// --- AI assistant chat ---

export const listAiMessages = (before) => unwrap(client.get('/ai-chat/messages', { params: { before } }));
export const sendAiMessage = (content) => unwrap(client.post('/ai-chat/messages', { content }));

// --- settings ---

export const getSettings = () => unwrap(client.get('/settings'));
export const updateSettings = (payload) => unwrap(client.put('/settings', payload));

// --- banners ---

export const listBanners = () => unwrap(client.get('/banners'));
  