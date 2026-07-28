import * as Speech from 'expo-speech';

// expo-speech's default rate (1.0) read reminder titles/messages too fast to
// follow - slowed down per user feedback. Shared by both places a reminder
// gets spoken aloud (ReminderAlertWatcher's foreground fallback and
// _layout.js's real-push handler) so the pace stays consistent everywhere.
const REMINDER_SPEECH_RATE = 0.75;

export const speakReminder = (text) => Speech.speak(text, { rate: REMINDER_SPEECH_RATE });
