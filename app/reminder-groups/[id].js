import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, Switch, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { TextField } from '../../src/components/TextField.js';
import { Button } from '../../src/components/Button.js';
import { RecipientPicker } from '../../src/components/RecipientPicker.js';
import { Avatar } from '../../src/components/Avatar.js';
import {
  getReminderGroup,
  createReminderGroup,
  deleteReminderGroup,
  setGroupSelfReminder,
  listReminders,
  getErrorMessage,
} from '../../src/api/index.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function ReminderGroupDetail() {
  const router = useRouter();
  const { id, projectId: projectIdParam } = useLocalSearchParams();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [group, setGroup] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!isNew);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const data = await getReminderGroup(id);
      setGroup(data);
    } catch {
      Alert.alert('Could not load group', 'Please try again.');
    } finally {
      setLoadingExisting(false);
    }
    try {
      setReminders(await listReminders({ groupId: id }).then((r) => r.items || []));
    } catch {
      setReminders([]);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!isNew) load();
    }, [load, isNew])
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a group name.');
      return;
    }
    setLoading(true);
    try {
      const newGroup = await createReminderGroup({
        projectId: projectIdParam,
        name: name.trim(),
        memberUserIds: members.map((m) => m.id),
      });
      router.replace(`/reminder-groups/${newGroup.id}`);
    } catch (err) {
      Alert.alert('Could not create group', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelfReminder = async (value) => {
    setGroup((g) => ({ ...g, creator_self_reminder: value }));
    try {
      await setGroupSelfReminder(id, value);
    } catch (err) {
      setGroup((g) => ({ ...g, creator_self_reminder: !value }));
      Alert.alert('Could not update setting', getErrorMessage(err));
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete group', `Delete "${group?.name}"? Its reminders will be removed too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminderGroup(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete group', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (isNew) {
    return (
      <ScreenContainer>
        <Header title="" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>New Group</Text>
          <TextField label="Group Name" placeholder="Follow-up team" value={name} onChangeText={setName} voiceInput />
          <RecipientPicker label="Add members" value={members} onChange={setMembers} maxRecipients={Infinity} />
          <Button title="Create Group" onPress={handleCreate} loading={loading} style={styles.submit} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (loadingExisting || !group) {
    return (
      <ScreenContainer>
        <Header title="" />
        <Text style={styles.loadingText}>Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title=""
        right={
          group.is_creator ? (
            <Pressable onPress={handleDelete} hitSlop={12}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{group.name}</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members</Text>
          {group.is_creator ? (
            <Pressable onPress={() => router.push(`/reminder-groups/${id}/members`)}>
              <Text style={styles.manageLink}>Manage</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.membersList}>
          {group.members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <Avatar name={m.name} uri={m.avatar_url} size={32} />
              <Text style={styles.memberName} numberOfLines={1}>{m.name}</Text>
              {!m.can_manage ? <Text style={styles.restrictedBadge}>View only</Text> : null}
            </View>
          ))}
        </View>

        {group.is_creator ? (
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Notify me too</Text>
              <Text style={styles.toggleHint}>
                You're a member of your own group - turn this off if you don't want the reminders yourself.
              </Text>
            </View>
            <Switch value={!!group.creator_self_reminder} onValueChange={handleToggleSelfReminder} />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reminders</Text>
          {group.can_manage ? (
            <Pressable onPress={() => router.push({ pathname: '/group-reminders/new', params: { groupId: id } })}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>
        <FlatList
          data={reminders}
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable style={styles.reminderRow} onPress={() => router.push(`/group-reminders/${item.id}`)}>
              <View style={styles.reminderBody}>
                <Text style={styles.reminderTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.reminderMeta}>{item.reminder_date}{item.reminder_time ? ` · ${item.reminder_time.slice(0, 5)}` : ''}</Text>
              </View>
              {item.is_completed ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No reminders yet in this group.</Text>}
        />
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
    marginBottom: spacing.lg,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  submit: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  manageLink: {
    ...typography.bodyMuted,
    color: colors.primary,
    fontWeight: '600',
  },
  membersList: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  memberName: {
    ...typography.body,
    flex: 1,
  },
  restrictedBadge: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  toggleLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  toggleHint: {
    ...typography.caption,
    marginTop: 2,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  reminderBody: {
    flex: 1,
  },
  reminderTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  reminderMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
