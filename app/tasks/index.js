import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { BottomNavBar } from '../../src/components/BottomNavBar.js';
import { listReminders } from '../../src/api/index.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

export default function TasksList() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Every type:'task' reminder - both Project Tasks (project_id set,
      // via this screen's own "+" or a Project's "+ Add Task") and personal
      // ones created via the older generic Add Reminder -> Task flow, which
      // has no project_id. Both are worth surfacing here so nothing you
      // created as a "Task" is invisible from the one screen named Tasks -
      // the row subtitle below distinguishes which is which.
      // No dedicated "every task across every project" filter on the
      // backend, so this asks for the largest page the API allows (100 -
      // see reminders.validation.js) and filters client-side - fine at
      // personal-business scale.
      const { items } = await listReminders({ pageSize: 100 });
      setTasks((items || []).filter((r) => r.type === 'task'));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const typeStyle = reminderTypeStyles.task;

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header title="" right={
        <Pressable onPress={() => router.push('/tasks/new')} hitSlop={10}>
          <Ionicons name="add" size={26} color={colors.text} />
        </Pressable>
      } />
      <View style={styles.titleWrap}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.subtitle}>Every task - personal, or assigned within a project</Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const isMine = String(item.user_id) === String(user?.id);
          const kind = item.project_id ? (isMine ? 'Assigned by you' : 'Assigned to you') : 'Personal';
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push(item.project_id ? `/tasks/${item.id}` : { pathname: '/reminders/task', params: { id: item.id } })
              }
            >
              <View style={[styles.iconWrap, { backgroundColor: typeStyle.bg }]}>
                <MaterialCommunityIcons name={typeStyle.icon} size={22} color={typeStyle.color} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.reminder_date}{item.reminder_time ? ` · ${item.reminder_time.slice(0, 5)}` : ''} · {kind}
                </Text>
              </View>
              {item.is_completed ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : null}
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No tasks yet. Tap + to add one.</Text> : null}
      />

      <BottomNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  titleWrap: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMuted,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});
