import { useEffect, useState } from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { getSettings, updateSettings } from '../src/api/index.js';
import { setPreferredSound } from '../src/utils/notifications.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const ROWS = [
  { key: 'push_notifications', payloadKey: 'pushNotifications', label: 'Push Notifications', description: 'Get alerts on this device' },
  { key: 'reminder_notifications', payloadKey: 'reminderNotifications', label: 'Reminder Notifications', description: 'Medicine, birthdays, tasks & more' },
];

// Android can only ever play a sound that was compiled into the app, never
// an arbitrary file off the user's own device - so this is a fixed choice
// between the system default and the one custom tone bundled with the app
// (assets/reminder_alert.wav), not an open file picker.
const SOUND_OPTIONS = [
  { key: 'default', label: 'Default', description: "Your phone's system notification sound" },
  { key: 'alert', label: 'Alert Tone', description: 'A custom tone bundled with LifeMate' },
];

export default function NotificationSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const alertPlayer = useAudioPlayer(require('../assets/reminder_alert.wav'));

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
    if (key !== 'alert') return;
    alertPlayer.seekTo(0);
    alertPlayer.play();
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
                  {opt.key === 'alert' ? (
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
