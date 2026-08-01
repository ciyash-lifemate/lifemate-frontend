import { View, Text, ScrollView, Pressable, Share, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { Avatar } from '../src/components/Avatar.js';
import { SwipeableTabScreen } from '../src/components/SwipeableTabScreen.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const MENU_SECTIONS = [
  {
    items: [
      {
        key: 'business-card',
        label: 'Business Card',
        subtitle: 'Create & share your digital card',
        icon: 'card-outline',
        iconBg: '#E0F2FE',
        iconColor: colors.blue,
      },
      {
        key: 'reminder-history',
        label: 'Reminder History',
        subtitle: 'View your past reminders',
        icon: 'time-outline',
        iconBg: '#E7F8ED',
        iconColor: colors.success,
      },
      {
        key: 'contacts',
        label: 'Contact Sync',
        subtitle: 'Find friends already using LifeMate',
        icon: 'people-outline',
        iconBg: '#FDE8F0',
        iconColor: colors.pink,
      },
    ],
  },
  {
    items: [
      {
        key: 'ai-settings',
        label: 'AI Settings',
        subtitle: 'Customize your AI experience',
        icon: 'sparkles-outline',
        iconBg: colors.primaryLight,
        iconColor: colors.primary,
      },
      {
        key: 'notification-settings',
        label: 'Notification Settings',
        subtitle: 'Manage your notifications',
        icon: 'notifications-outline',
        iconBg: '#FDF3E1',
        iconColor: colors.warning,
      },
    ],
  },
  {
    items: [
      {
        key: 'privacy',
        label: 'Privacy & Security',
        subtitle: 'Manage your privacy and security',
        icon: 'shield-checkmark-outline',
        iconBg: '#E0F2FE',
        iconColor: colors.blue,
      },
      {
        key: 'backup',
        label: 'Backup & Restore',
        subtitle: 'Backup your data to cloud',
        icon: 'cloud-upload-outline',
        iconBg: '#E7F8ED',
        iconColor: colors.success,
      },
      {
        key: 'help',
        label: 'Help & Support',
        subtitle: 'Get help and contact support',
        icon: 'help-circle-outline',
        iconBg: '#FDE9E9',
        iconColor: colors.danger,
      },
    ],
  },
];

// "May 2024" style, from whatever the backend sends for account creation -
// hidden entirely rather than guessed at if that field isn't present.
const formatMemberSince = (value) => {
  if (!value) return null;
  const d = new Date(value.includes('T') || value.includes(' ') ? value.replace(' ', 'T') : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const memberSince = formatMemberSince(user?.created_at);

  const handlePress = (key) => {
    if (key === 'business-card') {
      router.push('/business-card');
      return;
    }
    if (key === 'reminder-history') {
      router.push('/reminder-history');
      return;
    }
    if (key === 'contacts') {
      router.push('/contacts');
      return;
    }
    if (key === 'notification-settings') {
      router.push('/notification-settings');
      return;
    }
    Alert.alert('Coming soon', 'This section is not available yet.');
  };

  const handleShareApp = async () => {
    try {
      await Share.share({ message: 'I use LifeMate to stay on top of reminders, tasks and more - check it out!' });
    } catch {
      // Best-effort - the share sheet itself already surfaces its own errors.
    }
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
    <SwipeableTabScreen path="/profile">
    <ScreenContainer edges={['top']} style={styles.container}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>
          <View style={styles.heroTopActions}>
            <Pressable onPress={handleShareApp} hitSlop={12}>
              <Ionicons name="share-social-outline" size={22} color={colors.white} />
            </Pressable>
            <Pressable onPress={() => router.push('/notifications')} hitSlop={12}>
              <Ionicons name="notifications-outline" size={22} color={colors.white} />
            </Pressable>
          </View>
        </View>

        <View style={styles.avatarWrap}>
          <Avatar name={user?.name} size={84} />
          <Pressable style={styles.editBadge} onPress={() => router.push('/edit-profile')} hitSlop={8}>
            <Ionicons name="pencil" size={13} color={colors.primary} />
          </Pressable>
        </View>
        <Text style={styles.name}>{user?.name || 'Your Name'}</Text>
        <View style={styles.badge}>
          <Ionicons name="ribbon" size={13} color={colors.warning} />
          <Text style={styles.badgeText}>Premium User</Text>
        </View>
        {memberSince ? (
          <View style={styles.memberBadge}>
            <Ionicons name="calendar-outline" size={13} color={colors.white} />
            <Text style={styles.memberBadgeText}>Member since {memberSince}</Text>
          </View>
        ) : null}
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.premiumCard}>
          <View style={styles.premiumIconWrap}>
            <Ionicons name="diamond" size={22} color={colors.white} />
          </View>
          <View style={styles.premiumTextWrap}>
            <Text style={styles.premiumTitle}>LifeMate Premium</Text>
            <Text style={styles.premiumSubtitle}>You are enjoying all premium features</Text>
          </View>
          <Pressable
            style={styles.premiumBtn}
            onPress={() => Alert.alert('Coming soon', 'Premium plans are not available yet.')}
          >
            <Ionicons name="ribbon" size={14} color={colors.primary} />
            <Text style={styles.premiumBtnText}>View Benefits</Text>
          </Pressable>
        </View>

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
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
                  </View>
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
            <View style={styles.rowTextWrap}>
              <Text style={[styles.rowLabel, styles.logoutLabel]}>Logout</Text>
              <Text style={styles.rowSubtitle}>Sign out from your account</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
    </SwipeableTabScreen>
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
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.md,
  },
  heroTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  name: {
    ...typography.h2,
    color: colors.white,
    marginTop: spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  memberBadgeText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  premiumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  premiumIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  premiumTextWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  premiumTitle: {
    ...typography.body,
    fontWeight: '700',
  },
  premiumSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  premiumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  premiumBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
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
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  rowSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  logoutLabel: {
    color: colors.danger,
  },
});
