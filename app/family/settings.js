import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { TextField } from '../../src/components/TextField.js';
import { Button } from '../../src/components/Button.js';
import { getFamilyGroup, updateFamilyGroup, leaveFamilyGroup, getErrorMessage } from '../../src/api/index.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function FamilyGroupSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const g = await getFamilyGroup();
      setGroup(g);
      setNameDraft(g?.name || '');
    } catch {
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isAdmin = group?.members?.some((m) => String(m.user_id) === String(user?.id) && m.is_admin);

  const handleSaveName = async () => {
    if (!nameDraft.trim()) return;
    setSaving(true);
    try {
      setGroup(await updateFamilyGroup(nameDraft.trim()));
      setEditingName(false);
    } catch (err) {
      Alert.alert('Could not rename group', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLeave = () => {
    Alert.alert(
      isAdmin ? 'Delete family group' : 'Leave family group',
      isAdmin
        ? 'You are the admin - leaving deletes this group for everyone. This cannot be undone.'
        : "You'll stop seeing reminders shared in this group.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isAdmin ? 'Delete Group' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              await leaveFamilyGroup();
              router.replace('/family');
            } catch (err) {
              setLeaving(false);
              Alert.alert('Could not leave group', getErrorMessage(err));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <ScreenContainer edges={['top']} style={styles.container}>
        <Header title="Family Group Settings" />
        <Text style={styles.emptyText}>Loading…</Text>
      </ScreenContainer>
    );
  }

  if (!group) {
    return (
      <ScreenContainer edges={['top']} style={styles.container}>
        <Header title="Family Group Settings" />
        <Text style={styles.emptyText}>You're not part of a family group.</Text>
      </ScreenContainer>
    );
  }

  const admin = group.members.find((m) => m.is_admin);

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header title="Family Group Settings" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.groupCard}>
          <View style={styles.groupIconWrap}>
            <Ionicons name="people" size={24} color={colors.white} />
          </View>
          <View style={styles.groupTextWrap}>
            {editingName ? (
              <TextField value={nameDraft} onChangeText={setNameDraft} containerStyle={styles.nameInput} />
            ) : (
              <Text style={styles.groupName}>{group.name}</Text>
            )}
            <Text style={styles.groupMeta}>{group.members.length} members</Text>
          </View>
          {isAdmin ? (
            editingName ? (
              <Pressable onPress={handleSaveName} hitSlop={10} disabled={saving}>
                <Ionicons name="checkmark" size={22} color={colors.success} />
              </Pressable>
            ) : (
              <Pressable onPress={() => setEditingName(true)} hitSlop={10}>
                <Ionicons name="pencil" size={18} color={colors.primary} />
              </Pressable>
            )
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Ionicons name="ribbon-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>Group Admin</Text>
            <Text style={styles.rowValue}>{admin?.name || '—'}</Text>
          </View>
          <Pressable style={[styles.row, styles.rowLast]} onPress={() => router.push('/family')}>
            <Ionicons name="people-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>Manage Members</Text>
            <Text style={styles.rowValue}>{group.members.length} members</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Pressable style={[styles.row, styles.rowLast]} onPress={() => router.push('/notification-settings')}>
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>Notification Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <Button
          title={isAdmin ? 'Delete Group' : 'Leave Group'}
          onPress={handleLeave}
          loading={leaving}
          style={styles.leaveBtn}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  groupIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTextWrap: {
    flex: 1,
  },
  groupName: {
    ...typography.h3,
  },
  groupMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  nameInput: {
    marginBottom: 0,
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
    gap: spacing.sm,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    ...typography.body,
    flex: 1,
  },
  rowValue: {
    ...typography.bodyMuted,
  },
  leaveBtn: {
    backgroundColor: colors.danger,
    marginTop: spacing.sm,
  },
});
