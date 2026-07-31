import { useEffect, useRef, useState } from 'react';
import { View, Text, Switch, Pressable, Linking, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { createAudioPlayer } from 'expo-audio';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { getSettings, updateSettings } from '../src/api/index.js';
import { SOUND_CATALOG, setPreferredSound } from '../src/utils/notifications.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const ROWS = [
  { key: 'push_notifications', payloadKey: 'pushNotifications', label: 'Push Notifications', description: 'Get alerts on this device' },
  { key: 'reminder_notifications', payloadKey: 'reminderNotifications', label: 'Reminder Notifications', description: 'Medicine, birthdays, tasks & more' },
];

// Android can only ever play a sound that was compiled into the app, never
// an arbitrary file off the user's own device - so this is a fixed catalog
// (see SOUND_CATALOG in src/utils/notifications.js, the single source of
// truth both this picker and channel setup read from), not an open file
// picker. Metro needs a literal require() per file (a dynamic path built
// from the id string won't bundle), so each preview-able sound gets its own
// entry here keyed by id.
const PREVIEW_ASSETS = {
  alert: require('../assets/reminder_alert.wav'),
  bell: require('../assets/sounds/sound_bell.mp3'),
  bells: require('../assets/sounds/sound_bells.mp3'),
  pop: require('../assets/sounds/sound_pop.mp3'),
  confirm: require('../assets/sounds/sound_confirm.mp3'),
  positive: require('../assets/sounds/sound_positive.mp3'),
  doorbell: require('../assets/sounds/sound_doorbell.mp3'),
  digital: require('../assets/sounds/sound_digital.mp3'),
  magic: require('../assets/sounds/sound_magic.mp3'),
  clear: require('../assets/sounds/sound_clear.mp3'),
  urgent: require('../assets/sounds/sound_urgent.mp3'),
};

const SOUND_OPTIONS = SOUND_CATALOG.map(({ id, label }) => ({
  key: id,
  label,
  description: id === 'default' ? "Your phone's system notification sound" : 'Tap the play icon to preview',
}));

export default function NotificationSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  // One player created on demand per preview tap, not a hook per sound -
  // React's hook rules don't allow calling useAudioPlayer in a loop over
  // SOUND_CATALOG, so this uses expo-audio's plain (non-hook) player
  // factory instead. The previous preview's player is torn down before
  // starting a new one so tapping through several tones in a row doesn't
  // leak a growing pile of native player instances.
  const previewPlayerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSettings();
        setSettings(data);
        // Seeds the local cache src/utils/localReminders.js reads when
        // scheduling - covers the case where the sound was last changed on
        // a different device (or before this app version even had this
        // screen), so this device's local alerts still match.
        setPreferredSound(data?.notification_sound || 'default');
      } catch {
        setSettings({});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (row, value) => {
    setSettings((prev) => ({ ...prev, [row.key]: value }));
    try {
      await updateSettings({ [row.payloadKey]: value });
    } catch {
      setSettings((prev) => ({ ...prev, [row.key]: !value }));
    }
  };

  const handleSelectSound = async (key) => {
    const previous = settings?.notification_sound || 'default';
    setSettings((prev) => ({ ...prev, notification_sound: key }));
    setPreferredSound(key);
    try {
      await updateSettings({ notificationSound: key });
    } catch {
      setSettings((prev) => ({ ...prev, notification_sound: previous }));
      setPreferredSound(previous);
    }
  };

  const handlePreviewSound = (key) => {
    const asset = PREVIEW_ASSETS[key];
    if (!asset) return;
    previewPlayerRef.current?.remove();
    const player = createAudioPlayer(asset);
    previewPlayerRef.current = player;
    player.play();
  };

  useEffect(() => () => previewPlayerRef.current?.remove(), []);

  // Android 12+ only schedules a reminder's local alarm at its exact minute
  // when the app holds the "Alarms & reminders" special permission -
  // there's no way to check or request it from JS (expo-notifications
  // silently falls back to an inexact alarm the OS is free to batch/delay
  // by anywhere from a few seconds to a few minutes when it's missing, see
  // ExpoSchedulingDelegate.kt). Many phones (Vivo/Oppo/Xiaomi especially)
  // don't auto-grant this on install, which is why a reminder can land late
  // even though everything else about it fired correctly. No JS API exists
  // to detect the current state either, so this is a plain button rather
  // than a conditional one.
  const handleFixLateReminders = () => {
    if (Platform.OS !== 'android') return;
    Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM').catch(() => Linking.openSettings());
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Loading…</Text>
      ) : (
        <>
          <View style={styles.section}>
            {ROWS.map((row, i) => (
              <View key={row.key} style={[styles.row, i === ROWS.length - 1 && styles.rowLast]}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowDescription}>{row.description}</Text>
                </View>
                <Switch
                  value={!!settings?.[row.key]}
                  onValueChange={(value) => handleToggle(row, value)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Reminder Sound</Text>
          <View style={styles.section}>
            {SOUND_OPTIONS.map((opt, i) => {
              const isSelected = (settings?.notification_sound || 'default') === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.row, i === SOUND_OPTIONS.length - 1 && styles.rowLast]}
                  onPress={() => handleSelectSound(opt.key)}
                >
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{opt.label}</Text>
                    <Text style={styles.rowDescription}>{opt.description}</Text>
                  </View>
                  {PREVIEW_ASSETS[opt.key] ? (
                    <Pressable hitSlop={10} onPress={() => handlePreviewSound(opt.key)} style={styles.previewBtn}>
                      <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
                    </Pressable>
                  ) : null}
                  <View style={[styles.radio, isSelected && styles.radioActive]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {Platform.OS === 'android' ? (
            <>
              <Text style={styles.sectionTitle}>Reminders Coming Late?</Text>
              <View style={styles.section}>
                <Pressable style={[styles.row, styles.rowLast]} onPress={handleFixLateReminders}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>Enable Precise Reminder Timing</Text>
                    <Text style={styles.rowDescription}>
                      Some phones delay reminders by up to a minute unless you turn on "Alarms &amp; reminders" for
                      LifeMate. Tap to open that setting.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
  },
  sectionTitle: {
    ...typography.h3,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowBody: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  rowDescription: {
    ...typography.caption,
    marginTop: 2,
  },
  previewBtn: {
    marginRight: spacing.sm,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
