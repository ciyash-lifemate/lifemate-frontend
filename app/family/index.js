import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { BottomNavBar } from '../../src/components/BottomNavBar.js';
import { Avatar } from '../../src/components/Avatar.js';
import { Button } from '../../src/components/Button.js';
import { NoInternetView } from '../../src/components/NoInternetView.js';
import {
  getFamilyGroup,
  listSharedReminders,
  updateFamilyMemberPermission,
  removeFamilyMember,
  getErrorMessage,
} from '../../src/api/index.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const PERMISSION_LABEL = { view: 'View only', edit: 'Can edit', add: 'Can add', full: 'Full access' };
const PERMISSION_ICON = {
  view: 'eye-outline',
  edit: 'pencil-outline',
  add: 'add-circle-outline',
  full: 'shield-checkmark-outline',
};
const PERMISSION_ORDER = ['view', 'edit', 'add', 'full'];

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const countInRange = (reminders, from, to) =>
  reminders.filter((r) => r.reminder_date >= from && r.reminder_date <= to).length;

export default function FamilySharing() {
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  // True only when getFamilyGroup below failed to reach the server at all
  // (see the catch) - without this, a real network failure rendered the
  // exact same "No family group yet / Create Family Group" empty state as a
  // genuinely groupless account, which read as "you haven't set this up"
  // when the real story was "couldn't check". See NoInternetView.js.
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await getFamilyGroup();
      setGroup(g);
      setOffline(false);
      if (g) {
        const all = await listSharedReminders('all').catch(() => []);
        setReminders(Array.isArray(all) ? all : []);
      } else {
        setReminders([]);
      }
    } catch (err) {
      setGroup(null);
      setReminders([]);
      setOffline(!err?.response);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const today = new Date();
  const todayKey = toKey(today);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  const monthEnd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())}`;

  const todayCount = countInRange(reminders, todayKey, todayKey);
  const weekCount = countInRange(reminders, toKey(weekStart), toKey(weekEnd));
  const monthCount = countInRange(reminders, monthStart, monthEnd);

  const myMembership = group?.members?.find((m) => String(m.user_id) === String(user?.id));
  const canManage = myMembership?.permission === 'full';

  const handleMemberPress = (member) => {
    if (!canManage || member.is_admin) return;
    const buttons = PERMISSION_ORDER.filter((p) => p !== member.permission).map((p) => ({
      text: `Set to "${PERMISSION_LABEL[p]}"`,
      onPress: async () => {
        try {
          const updated = await updateFamilyMemberPermission(member.id, p);
          setGroup(updated);
        } catch (err) {
          Alert.alert('Could not update', getErrorMessage(err));
        }
      },
    }));
    buttons.push({
      text: 'Remove from family',
      style: 'destructive',
      onPress: async () => {
        try {
          const updated = await removeFamilyMember(member.id);
          setGroup(updated);
        } catch (err) {
          Alert.alert('Could not remove', getErrorMessage(err));
        }
      },
    });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(member.name || 'Member', 'What would you like to do?', buttons);
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header
        title="Family Sharing"
        right={
          group ? (
            <Pressable onPress={() => router.push('/family/add')} hitSlop={10}>
              <Text style={styles.addLink}>+ Add</Text>
            </Pressable>
          ) : null
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.banner}>
          <Text style={styles.bannerTitle}>Life is better together 💜</Text>
          <Text style={styles.bannerSubtitle}>Share reminders, care for your family and stay connected.</Text>
        </LinearGradient>

        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : offline ? (
          <NoInternetView onRetry={load} />
        ) : !group ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={32} color={colors.primary} />
            <Text style={styles.emptyTitle}>No family group yet</Text>
            <Text style={styles.emptySubtitle}>
              Create one to start sharing reminders with your family and see who's doing what.
            </Text>
            <Button title="Create Family Group" onPress={() => router.push('/family/add')} style={styles.emptyBtn} />
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Family Members</Text>
            <View style={styles.section}>
              {group.members.map((member, i) => {
                const isMe = String(member.user_id) === String(user?.id);
                const roleText = member.is_admin
                  ? `Admin${isMe ? ' • You' : ''}`
                  : `${PERMISSION_LABEL[member.permission]}${isMe ? ' • You' : ''}`;
                const roleIcon = member.is_admin ? 'ribbon' : PERMISSION_ICON[member.permission];
                return (
                  <Pressable
                    key={member.id}
                    style={[styles.row, i === group.members.length - 1 && styles.rowLast]}
                    onPress={() => handleMemberPress(member)}
                  >
                    <Avatar name={member.name} uri={member.avatar_url} size={40} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{member.name || 'Member'}</Text>
                      <Text style={styles.rowSubtitle}>{roleText}</Text>
                    </View>
                    <Ionicons
                      name={roleIcon}
                      size={18}
                      color={member.is_admin ? colors.warning : colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionTitle}>Shared Reminders</Text>
            <Pressable style={styles.statsRow} onPress={() => router.push('/family/reminders')}>
              <View style={styles.statTile}>
                <Text style={styles.statNumber}>{todayCount}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statNumber}>{weekCount}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statNumber}>{monthCount}</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </View>
            </Pressable>

            <Pressable style={styles.settingsLink} onPress={() => router.push('/family/settings')}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
              <Text style={styles.settingsLinkText}>Family Group Settings</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </>
        )}
      </ScrollView>

      <BottomNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  addLink: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  banner: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  bannerTitle: {
    ...typography.h3,
    color: colors.white,
    marginBottom: spacing.xs,
  },
  bannerSubtitle: {
    ...typography.bodyMuted,
    color: 'rgba(255,255,255,0.9)',
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyBtn: {
    alignSelf: 'stretch',
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  rowSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  statNumber: {
    ...typography.h2,
    color: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    marginTop: 2,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  settingsLinkText: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
  },
});
