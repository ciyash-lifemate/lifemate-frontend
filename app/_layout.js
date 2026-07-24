import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext.js';
import { ReminderAlertWatcher } from '../src/components/ReminderAlertWatcher.js';
import { setupNotifications, subscribeToNotificationTaps } from '../src/utils/notifications.js';

// Navigates to the right screen when the user taps a push/local
// notification. The backend's reminder scheduler sends { type: 'reminder',
// reminderId, reminderType } in the push payload's data field; chat pushes
// send { type: 'chat', chatId }. Calls aren't implemented yet, so that data
// type is ignored for now.
const handleNotificationTap = (router) => (data) => {
  if (!data) return;
  if (data.type === 'reminder' && data.reminderType) {
    router.push({ pathname: `/reminders/${data.reminderType}`, params: { id: data.reminderId } });
  } else if (data.type === 'chat' && data.chatId) {
    router.push(`/chats/${data.chatId}`);
  }
};

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    setupNotifications();
    return subscribeToNotificationTaps(handleNotificationTap(router));
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <ReminderAlertWatcher />
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
