import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Switch, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../../src/components/ScreenContainer.js';
import { Header } from '../../../src/components/Header.js';
import { RecipientPicker } from '../../../src/components/RecipientPicker.js';
import { Avatar } from '../../../src/components/Avatar.js';
import {
  getReminderGroup,
  addGroupMembers,
  removeGroupMember,
  setGroupMemberAccess,
  getErrorMessage,
} from '../../../src/api/index.js';
import { colors, radius, spacing, typography } from '../../../src/theme.js';

export default function ReminderGroupMembers() {
  const { id } = useLocalSearchParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setGroup(await getReminderGroup(id));
    } catch (err) {
      Alert.alert('Could not load group', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handlePickerChange = async (nextValue) => {
    const currentIds = group.members.map((m) => String(m.id));
    const nextIds = nextValue.map((m) => String(m.id));

    const addedUser = nextValue.find((u) => !currentIds.includes(String(u.id)));
    const removedId = currentIds.find((memberId) => !nextIds.includes(memberId));

    try {
      if (addedUser) await addGroupMembers(id, [addedUser.id]);
      if (removedId) await removeGroupMember(id, removedId);
      await load();
    } catch (err) {
      Alert.alert('Could not update members', getErrorMessage(err));
    }
  };

  const handleToggleManage = async (member, value) => {
    setGroup((g) => ({
      ...g,
      members: g.members.map((m) => (m.id === member.id ? { ...m, can_manage: value } : m)),
    }));
    try {
      await setGroupMemberAccess(id, member.id, value);
    } catch (err) {
      Alert.alert('Could not update access', getErrorMessage(err));
      load();
    }
  };

  if (loading || !group) {
    return (
      <ScreenContainer>
        <Header title="" />
        <Text style={styles.loadingText}>Loading…</Text>
      </ScreenContainer>
    );
  }

  if (!group.is_creator) {
    return (
      <ScreenContainer>
        <Header title="" />
        <Text style={styles.loadingText}>Only the group creator can manage members.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header title="" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Manage Members</Text>
        <Text style={styles.subheading}>{group.name}</Text>

        <RecipientPicker label="Members" value={group.members} onChange={handlePickerChange} maxRecipients={Infinity} />

        <Text style={styles.sectionTitle}>Manage access</Text>
        <Text style={styles.sectionHint}>
          Every member can create, edit, delete and update reminders in this group by default - turn this off for
          someone if you want to restrict them to just receiving reminders.
        </Text>
        <View style={styles.list}>
          {group.members.map((member) => {
            const isCreator = String(member.id) === String(group.created_by);
            return (
              <View key={member.id} style={styles.row}>
                <Avatar name={member.name} uri={member.avatar_url} size={36} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{member.name}</Text>
                  {isCreator ? <Text style={styles.rowHint}>Group creator</Text> : null}
                </View>
                {isCreator ? (
                  <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                ) : (
                  <Switch value={!!member.can_manage} onValueChange={(v) => handleToggleManage(member, v)} />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heading: {
    ...typography.h1,
  },
  subheading: {
    ...typography.bodyMuted,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    marginTop: spacing.lg,
  },
  sectionHint: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  list: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    ...typography.body,
    fontWeight: '600',
  },
  rowHint: {
    ...typography.caption,
    marginTop: 2,
  },
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
