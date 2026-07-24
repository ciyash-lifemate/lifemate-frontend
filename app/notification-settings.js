import { useEffect, useState } from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { getSettings, updateSettings } from '../src/api/index.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const ROWS = [
  { key: 'push_notifications', payloadKey: 'pushNotifications', label: 'Push Notifications', description: 'Get alerts on this device' },
  { key: 'reminder_notifications', payloadKey: 'reminderNotifications', label: 'Reminder Notifications', description: 'Medicine, birthdays, tasks & more' },
  { key: 'chat_notifications', payloadKey: 'chatNotifications', label: 'Chat Notifications', description: 'New messages from people and LifeMate AI' },
];

export default function NotificationSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setSettings(await getSettings());
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
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
