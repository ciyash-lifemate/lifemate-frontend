import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { setupNotifications } from '../utils/notifications.js';
import { resyncLocalReminders } from '../utils/localReminders.js';
import { syncQueuedReminders } from '../utils/offlineReminderQueue.js';
import { syncQueuedCompletions } from '../utils/offlineCompleteQueue.js';
import { useAuth } from '../context/AuthContext.js';

// Keeps the on-device local notification schedule (see
// src/utils/localReminders.js) in sync with the server's reminder list -
// re-derives it on every app foreground so a reminder created/edited/
// completed elsewhere (another device, or a mutation this session didn't
// explicitly resync after) still ends up reflected here without the user
// having to do anything. Individual screens also call resyncLocalReminders()
// directly right after a save/delete for an instant update - this component
// is the periodic safety net, not the only trigger.
export const LocalReminderSync = () => {
  const { user } = useAuth();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user) return undefined;

    const runSync = async () => {
      // setupNotifications() is safe to call more than once - makes sure
      // permission has been requested even if this mounts before
      // NotificationTapRouter's own setup call resolves.
      await setupNotifications();
      // Replay any reminders that were created while offline before
      // re-deriving the schedule, so a just-synced reminder ends up keyed
      // under its real server id instead of lingering as a draft.
      await syncQueuedReminders(user.id);
      await syncQueuedCompletions();
      await resyncLocalReminders(user.id);
    };

    if (!startedRef.current && AppState.currentState === 'active') {
      startedRef.current = true;
      runSync();
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync();
    });

    return () => subscription.remove();
  }, [user]);

  return null;
};
