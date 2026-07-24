import { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Avatar } from '../../src/components/Avatar.js';
import { searchUsers, startChat } from '../../src/api/index.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

export default function NewChat() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchUsers(trimmed);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = async (person) => {
    setStartingId(person.id);
    try {
      const { chatId } = await startChat(person.id);
      router.replace({ pathname: `/chats/${chatId}`, params: { name: person.name } });
    } catch (err) {
      setStartingId(null);
      Alert.alert('Could not start chat', err.response?.data?.message || 'Please try again.');
    }
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Chat</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people by name..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => handleSelect(item)} disabled={startingId === item.id}>
            <Avatar name={item.name} />
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            {startingId === item.id ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          !searching && query.trim().length >= 2 ? (
            <Text style={styles.emptyText}>No people found for "{query.trim()}".</Text>
          ) : null
        }
      />
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
    ...typography.h3,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowName: {
    ...typography.body,
    fontWeight: '600',
    marginLeft: spacing.md,
    flex: 1,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
