import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { TextField } from '../../src/components/TextField.js';
import { Button } from '../../src/components/Button.js';
import {
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listReminderGroups,
  listReminders,
  getErrorMessage,
} from '../../src/api/index.js';
import { colors, hierarchyStyles, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

export default function ProjectDetail() {
  const router = useRouter();
  const { id, companyId: companyIdParam } = useLocalSearchParams();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [companyId, setCompanyId] = useState(companyIdParam);
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!isNew);

  const loadGroups = useCallback(async () => {
    if (isNew) return;
    try {
      setGroups(await listReminderGroups(id));
    } catch {
      setGroups([]);
    }
  }, [id, isNew]);

  const loadTasks = useCallback(async () => {
    if (isNew) return;
    try {
      const { items } = await listReminders({ projectId: id });
      setTasks(items || []);
    } catch {
      setTasks([]);
    }
  }, [id, isNew]);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const project = await getProject(id);
        setName(project.name || '');
        setNotes(project.notes || '');
        setCompanyId(project.company_id);
      } catch {
        Alert.alert('Could not load project', 'Please try again.');
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [id, isNew]);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
      loadTasks();
    }, [loadGroups, loadTasks])
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a project name.');
      return;
    }
    setLoading(true);
    try {
      if (isNew) {
        const project = await createProject({ companyId, name: name.trim(), notes: notes.trim() || undefined });
        router.replace(`/projects/${project.id}`);
      } else {
        await updateProject(id, { name: name.trim(), notes: notes.trim() });
        setEditing(false);
      }
    } catch (err) {
      Alert.alert('Could not save project', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete project', `Delete "${name}"? Its groups and reminders will be removed too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProject(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete project', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loadingExisting) {
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
          !isNew ? (
            <View style={styles.headerActions}>
              <Pressable onPress={() => setEditing((v) => !v)} hitSlop={12}>
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={12}>
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            </View>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{isNew ? 'New Project' : name}</Text>

        {isNew || editing ? (
          <>
            <TextField label="Project Name" placeholder="Website Redesign" value={name} onChangeText={setName} voiceInput />
            <TextField
              label="Notes (optional)"
              placeholder="What this project is about"
              value={notes}
              onChangeText={setNotes}
              multiline
              style={styles.notesInput}
            />
            <Button title={isNew ? 'Create Project' : 'Save Changes'} onPress={handleSave} loading={loading} style={styles.submit} />
          </>
        ) : notes ? (
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyLabel}>Notes</Text>
            <Text style={styles.readOnlyValue}>{notes}</Text>
          </View>
        ) : null}

        {!isNew ? (
          <View style={styles.groupsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Groups</Text>
              <Pressable onPress={() => router.push({ pathname: '/reminder-groups/new', params: { projectId: id } })}>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              </Pressable>
            </View>

            <FlatList
              data={groups}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => router.push(`/reminder-groups/${item.id}`)}>
                  <View style={[styles.iconWrap, { backgroundColor: hierarchyStyles.group.bg }]}>
                    <MaterialCommunityIcons name={hierarchyStyles.group.icon} size={20} color={hierarchyStyles.group.color} />
                  </View>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No groups yet. Tap + to add one.</Text>}
            />
          </View>
        ) : null}

        {!isNew ? (
          <View style={styles.groupsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tasks</Text>
              <Pressable onPress={() => router.push({ pathname: '/tasks/new', params: { projectId: id } })}>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              </Pressable>
            </View>

            <FlatList
              data={tasks}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => router.push(`/tasks/${item.id}`)}>
                  <View style={[styles.iconWrap, { backgroundColor: reminderTypeStyles.task.bg }]}>
                    <MaterialCommunityIcons name={reminderTypeStyles.task.icon} size={20} color={reminderTypeStyles.task.color} />
                  </View>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  {item.is_completed ? <Ionicons name="checkmark-circle" size={18} color={colors.success} /> : null}
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No tasks yet. Tap + to add one.</Text>}
            />
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heading: {
    ...typography.h1,
    marginBottom: spacing.lg,
  },
  readOnlyField: {
    marginBottom: spacing.md,
  },
  readOnlyLabel: {
    ...typography.bodyMuted,
    marginBottom: spacing.xs,
  },
  readOnlyValue: {
    ...typography.body,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  submit: {
    marginTop: spacing.md,
  },
  groupsSection: {
    marginTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
    flex: 1,
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
    