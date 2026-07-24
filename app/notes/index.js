import { useCallback, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { BottomNavBar } from '../../src/components/BottomNavBar.js';
import { listNotes } from '../../src/api/index.js';
import { parseServerDate } from '../../src/utils/date.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const NOTE_COLORS = ['#FDF3E1', '#E8F0FE', '#FDE9E9', '#EEF0FF'];

const formatDate = (value) => {
  const d = parseServerDate(value);
  if (!d) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function NotesList() {
  const router = useRouter();
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query) => {
    try {
      const data = await listNotes(query);
      setNotes(Array.isArray(data) ? data : data?.items || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search);
    }, [load, search])
  );

  const handleSearchChange = (value) => {
    setSearch(value);
    load(value);
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Notes</Text>
        <Pressable onPress={() => router.push('/notes/new')} hitSlop={10}>
          <Ionicons name="add" size={26} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={handleSearchChange}
        />
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <Pressable
            style={[styles.card, { backgroundColor: NOTE_COLORS[index % NOTE_COLORS.length] }]}
            onPress={() => router.push(`/notes/${item.id}`)}
          >
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled'}</Text>
              <Text style={styles.cardPreview} numberOfLines={1}>{item.content || ''}</Text>
              <Text style={styles.cardDate}>{formatDate(item.updated_at || item.created_at)}</Text>
            </View>
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No notes yet. Tap + to add one.</Text> : null}
      />

      <BottomNavBar />
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
    ...typography.h1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardBody: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardPreview: {
    ...typography.bodyMuted,
    marginBottom: spacing.xs,
  },
  cardDate: {
    ...typography.caption,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
