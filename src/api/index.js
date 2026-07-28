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

// Backend validation errors carry a message in the response body; anything
// that never reached the backend (network failure, timeout, DNS) only has
// axios's own err.message (e.g. "Network Error") - fall back to that instead
// of a generic string so the alert reflects what actually went wrong.
export const getErrorMessage = (err, fallback = 'Please try again.') =>
  err?.response?.data?.message || err?.message || fallback;

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

export const listNotes = (search, page, pageSize) =>
  unwrap(client.get('/notes', { params: { search, page, pageSize } }));
export const getNote = (id) => unwrap(client.get(`/notes/${id}`));
export const createNote = (payload) => unwrap(client.post('/notes', payload));
export const updateNote = (id, payload) => unwrap(client.put(`/notes/${id}`, payload));
export const deleteNote = (id) => unwrap(client.delete(`/notes/${id}`));

// --- notifications ---

export const listNotifications = (type, page, pageSize) =>
  unwrap(client.get('/notifications', { params: { type, page, pageSize } }));
export const getUnreadNotificationCount = () => unwrap(client.get('/notifications/unread-count'));
export const markNotificationRead = (id) => unwrap(client.patch(`/notifications/${id}/read`));
export const markAllNotificationsRead = () => unwrap(client.patch('/notifications/read-all'));

export const registerDeviceToken = (token, platform) =>
  unwrap(client.post('/notifications/device-token', { token, platform }));
export const unregisterDeviceToken = (token, platform) =>
  unwrap(client.delete('/notifications/device-token', { data: { token, platform } }));

// --- AI assistant chat ---

export const listAiMessages = (before) => unwrap(client.get('/ai-chat/messages', { params: { before } }));
export const sendAiMessage = (content) => unwrap(client.post('/ai-chat/messages', { content }));

// --- settings ---

export const getSettings = () => unwrap(client.get('/settings'));
export const updateSettings = (payload) => unwrap(client.put('/settings', payload));

// --- business card ---

export const getBusinessCard = () => unwrap(client.get('/business-card'));
export const updateBusinessCard = (payload) => unwrap(client.put('/business-card', payload));

// --- banners ---

export const listBanners = () => unwrap(client.get('/banners'));
  