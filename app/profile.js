import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { Avatar } from '../src/components/Avatar.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const MENU_SECTIONS = [
  {
    items: [
      { key: 'edit-profile', label: 'Edit Profile', icon: 'person-outline' },
      { key: 'business-card', label: 'Business Card', icon: 'card-outline' },
      { key: 'reminder-history', label: 'Reminder History', icon: 'time-outline' },
    ],
  },
  {
    items: [
      { key: 'ai-settings', label: 'AI Settings', icon: 'sparkles-outline' },
      { key: 'notification-settings', label: 'Notification Settings', icon: 'notifications-outline' },
    ],
  },
  {
    items: [
      { key: 'privacy', label: 'Privacy & Security', icon: 'shield-checkmark-outline' },
      { key: 'backup', label: 'Backup & Restore', icon: 'cloud-upload-outline' },
      { key: 'help', label: 'Help & Support', icon: 'help-circle-outline' },
    ],
  },
];

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handlePress = (key) => {
    if (key === 'edit-profile') {
      router.push('/edit-profile');
      return;
    }
    if (key === 'business-card') {
      router.push('/business-card');
      return;
    }
    if (key === 'reminder-history') {
      router.push('/reminder-history');
      return;
    }
    if (key === 'notification-settings') {
      router.push('/notification-settings');
      return;
    }
    Alert.alert('Coming soon', 'This section is not available yet.');
  };

  const handleLogout = async () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/onboarding');
        },
      },
    ]);
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.hero}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.white} />
        </Pressable>
        <Avatar name={user?.name} size={84} />
        <Text style={styles.name}>{user?.name || 'Your Name'}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Premium User</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {MENU_SECTIONS.map((section, i) => (
          <View key={i}>
            {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
            <View style={styles.section}>
              {section.items.map((item, itemIndex) => (
                <Pressable
                  key={item.key}
                  style={[styles.row, itemIndex === section.items.length - 1 && styles.rowLast]}
                  onPress={() => handlePress(item.key)}
                >
                  <View style={[styles.rowIconWrap, item.iconBg && { backgroundColor: item.iconBg }]}>
                    <Ionicons name={item.icon} size={20} color={item.iconColor || colors.primary} />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Pressable style={[styles.row, styles.rowLast]} onPress={handleLogout}>
            <View style={[styles.rowIconWrap, styles.logoutIconWrap]}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            </View>
            <Text style={[styles.rowLabel, styles.logoutLabel]}>Logout</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginLeft: spacing.lg,
    marginBottom: spacing.md,
  },
  name: {
    ...typography.h2,
    color: colors.white,
    marginTop: spacing.md,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginTop: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.md,
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
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logoutIconWrap: {
    backgroundColor: '#FDE9E9',
  },
  rowLabel: {
    ...typography.body,
    flex: 1,
  },
  logoutLabel: {
    color: colors.danger,
    fontWeight: '600',
  },
});
