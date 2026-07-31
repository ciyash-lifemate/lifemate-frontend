import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { BottomNavBar } from '../../src/components/BottomNavBar.js';
import { Avatar } from '../../src/components/Avatar.js';
import { listReminders } from '../../src/api/index.js';
import { formatClockTime } from '../../src/utils/date.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

// reminder_time is a bare "HH:mm:ss" (or null for an all-day message) -
// falls back to the date so a chat-list row always has *something* on the
// right, the way a real chat list never shows a blank timestamp.
const formatRowMeta = (item) => {
  if (!item.reminder_time) return item.reminder_date;
  const [h, m] = item.reminder_time.slice(0, 5).split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatClockTime(d);
};

export default function BusinessNotesList() {
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await listReminders({ type: 'note', pageSize: 100 });
      setNotes(items || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header title="" right={
        <Pressable onPress={() => router.push('/business-notes/new')} hitSlop={10}>
          <Ionicons name="add" size={26} color={colors.text} />
        </Pressable>
      } />
      <View style={styles.titleWrap}>
        <Text style={styles.title}>Message</Text>
        <Text style={styles.subtitle}>Share a message with one or several people at once</Text>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/business-notes/${item.id}`)}>
            <Avatar name={item.title} size={48} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {item.description || 'Tap to view this reminder message'}
              </Text>
            </View>
            <Text style={styles.rowMeta}>{formatRowMeta(item)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No messages yet. Tap + to add one.</Text> : null}
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
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  rowMeta: {
    ...typography.caption,
    alignSelf: 'flex-start',
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
