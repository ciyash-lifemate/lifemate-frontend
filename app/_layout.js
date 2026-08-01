import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Contacts from 'expo-contacts/legacy';
import { AuthProvider, useAuth } from '../src/context/AuthContext.js';
import { ReminderAlertWatcher } from '../src/components/ReminderAlertWatcher.js';
import { LocalReminderSync } from '../src/components/LocalReminderSync.js';
import {
  setupNotifications,
  subscribeToNotificationTaps,
  subscribeToNotificationReceived,
} from '../src/utils/notifications.js';
import { speakReminder } from '../src/utils/speech.js';
import { openWhatsAppWish, buildWishMessage } from '../src/utils/whatsapp.js';
import { resyncLocalReminders } from '../src/utils/localReminders.js';

// Navigates to the right screen when the user taps a push/local
// notification. The backend's reminder scheduler sends { type: 'reminder',
// reminderId, reminderType } in the push payload's data field.
// A birthday/anniversary reminder configured with a wish (recipientMobile +
// wishMessage) opens WhatsApp pre-filled instead of the reminder screen -
// see src/utils/whatsapp.js for why it can't just send on its own.
const handleNotificationTap = (router, senderName) => (data) => {
  if (!data) return;
  if (data.type === 'reminder' && data.reminderType) {
    if (data.recipientMobile && data.wishMessage) {
      openWhatsAppWish(data.recipientMobile, buildWishMessage(data.recipientName, data.wishMessage, senderName));
      return;
    }
    // Company/Project/Group reminders carry groupId in the push payload
    // (see notifications.service.js) - they open their own permission-aware
    // screen instead of the generic per-type reminder form.
    if (data.groupId) {
      router.push(`/group-reminders/${data.reminderId}`);
      return;
    }
    // A Project Task carries projectId in the push/local-notification
    // payload (see notifications.service.js and src/utils/localReminders.js)
    // - it opens its own creator/assignee-aware screen instead.
    if (data.projectId) {
      router.push(`/tasks/${data.reminderId}`);
      return;
    }
    router.push({ pathname: `/reminders/${data.reminderType}`, params: { id: data.reminderId } });
  }
};

// The notification's own alert sound is played by the OS notification
// system itself here, not by any player this app controls, so unlike
// ReminderAlertWatcher's exact "didJustFinish" wait, there's no callback for
// "the system sound just finished" to hook into - this delay is a best-effort
// approximation of a short alert tone's length instead.
const SOUND_APPROX_MS = 1500;

// Speaks a reminder's custom voice message (or its title, if none was set)
// once its push notification lands while the app is open, alongside the
// notification's own sound - same voice idea as the "speak" button on the
// Notes screen, just triggered automatically instead of by a tap.
// `recipientName` is what the backend's scheduler names the plain reminder
// title in the push payload (see notifyReminderDue) - using it instead of
// content.title avoids reading out the emoji prefix (buildAlertCopy in
// reminders.scheduler.js).
const handleNotificationReceived = (userId) => (data) => {
  if (data?.type !== 'reminder') return;
  const text = data.voiceMessage || data.recipientName;
  if (text) setTimeout(() => speakReminder(text), SOUND_APPROX_MS);
  // A shared/assigned reminder just pushed in while the app was open -
  // resync the on-device schedule right away instead of waiting for the
  // next foreground transition (LocalReminderSync only re-derives it on an
  // inactive->active AppState change, which this isn't), so it's already
  // scheduled locally even if the recipient goes offline before it's due.
  if (userId) resyncLocalReminders(userId).catch(() => {});
};

// Lives inside AuthProvider (unlike the rest of RootLayout) purely so it can
// read the signed-in user's name for the wish message signature.
const NotificationTapRouter = () => {
  const router = useRouter();
  const { user } = useAuth();
  // Asked once per signed-in session, not on every re-render this effect
  // happens to run - requestPermissionsAsync() itself is already a no-op
  // once answered (Android/iOS never re-prompt without the user going to
  // Settings themselves), this ref just avoids firing it redundantly.
  const contactsAskedRef = useRef(false);

  useEffect(() => {
    setupNotifications();
    // Asked up front on first login rather than buried behind the Contact
    // Sync screen's own "Sync Now" button - that screen (app/contacts/index.js)
    // is unchanged otherwise; by the time someone opens it the OS prompt has
    // usually already been answered one way or another.
    if (user && !contactsAskedRef.current) {
      contactsAskedRef.current = true;
      Contacts.requestPermissionsAsync().catch(() => {});
    }
    const unsubscribeTap = subscribeToNotificationTaps(handleNotificationTap(router, user?.name));
    const unsubscribeReceived = subscribeToNotificationReceived(handleNotificationReceived(user?.id));
    return () => {
      unsubscribeTap();
      unsubscribeReceived();
    };
  }, [router, user, user?.name]);

  return null;
};

// expo-router ~57.0.7 doesn't have the Stack.Protected API (it's not
// attached to Stack in this version - confirmed in node_modules) despite
// current docs describing it, so this does the same thing by hand: the
// Stack's children set itself changes between the two screen groups
// whenever `user` flips, which is what Stack.Protected does internally too
// (see expo-router's mapProtectedScreen). React Navigation resets to the
// first screen of whichever set is now present, so there's no stale
// authenticated screen left on the stack for the back button to reach.
const RootNavigator = () => {
  const { user, isLoading } = useAuth();
  // Folded into the same ternary as !user (rather than an early-return with
  // no Stack.Screen children at all) so the Stack's shape only ever
  // transitions between these same two branches, never through a third
  // "empty" shape - mixing that in was tripping up React Navigation's
  // internal screen reconciliation. index.js itself is what's actually on
  // screen during loading regardless of which branch is technically
  // registered underneath it.
  const showAuthScreens = isLoading || !user;

  // A plain keyed array, not a <>...</> Fragment - expo-router's own child
  // filter (useFilterScreenChildren in withLayoutContext.js) walks Stack's
  // children with React.Children.forEach, which does NOT unwrap Fragments
  // the way Children.toArray does. A Fragment child fell into its "must be
  // of type Screen" catch-all and threw deeper in reconciliation ("Cannot
  // convert Symbol to string" - a Fragment's type is Symbol(react.fragment)).
  // A real array of elements doesn't have that problem: React always
  // flattens arrays natively, Fragment or not.
  const screens = showAuthScreens
    ? [
        <Stack.Screen key="onboarding" name="onboarding" />,
        <Stack.Screen key="login" name="login" />,
        <Stack.Screen key="otp" name="otp" />,
      ]
    : [
        <Stack.Screen key="create-profile" name="create-profile" />,
        <Stack.Screen key="home" name="home" />,
        <Stack.Screen key="notes/index" name="notes/index" />,
        <Stack.Screen key="notes/[id]" name="notes/[id]" />,
        <Stack.Screen key="ai-chat" name="ai-chat" />,
        <Stack.Screen key="reminders/add" name="reminders/add" />,
        <Stack.Screen key="reminders/[type]" name="reminders/[type]" />,
        <Stack.Screen key="reminder-history" name="reminder-history" />,
        <Stack.Screen key="calendar" name="calendar" />,
        <Stack.Screen key="notifications" name="notifications" />,
        <Stack.Screen key="notification-settings" name="notification-settings" />,
        <Stack.Screen key="profile" name="profile" />,
        <Stack.Screen key="edit-profile" name="edit-profile" />,
        <Stack.Screen key="business-card" name="business-card" />,
        <Stack.Screen key="companies/index" name="companies/index" />,
        <Stack.Screen key="companies/[id]" name="companies/[id]" />,
        <Stack.Screen key="companies/[id]/projects" name="companies/[id]/projects" />,
        <Stack.Screen key="projects/[id]" name="projects/[id]" />,
        <Stack.Screen key="reminder-groups/[id]" name="reminder-groups/[id]" />,
        <Stack.Screen key="reminder-groups/[id]/members" name="reminder-groups/[id]/members" />,
        <Stack.Screen key="group-reminders/[id]" name="group-reminders/[id]" />,
        <Stack.Screen key="tasks/index" name="tasks/index" />,
        <Stack.Screen key="tasks/[id]" name="tasks/[id]" />,
      ];

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {screens}
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <NotificationTapRouter />
          <ReminderAlertWatcher />
          <LocalReminderSync />
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
