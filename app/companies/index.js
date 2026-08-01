import { useCallback, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { BottomNavBar } from '../../src/components/BottomNavBar.js';
import { NoInternetView } from '../../src/components/NoInternetView.js';
import { SwipeableTabScreen } from '../../src/components/SwipeableTabScreen.js';
import { listCompanies } from '../../src/api/index.js';
import { colors, hierarchyStyles, radius, spacing, typography } from '../../src/theme.js';

export default function CompaniesList() {
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  // True only when the load below failed to reach the server at all (see
  // the catch) - see src/components/NoInternetView.js for why this is
  // tracked separately from a genuinely empty list.
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCompanies(await listCompanies());
      setOffline(false);
    } catch (err) {
      setCompanies([]);
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

  const filtered = companies.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <SwipeableTabScreen path="/companies">
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header title="" right={
        <Pressable onPress={() => router.push('/companies/new')} hitSlop={10}>
          <Ionicons name="add" size={26} color={colors.text} />
        </Pressable>
      } />
      <View style={styles.titleWrap}>
        <Text style={styles.title}>Companies</Text>
        <Text style={styles.subtitle}>Organize your business follow-ups</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search companies..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {!loading && offline && companies.length === 0 ? (
        <NoInternetView onRetry={load} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/companies/${item.id}`)}>
              <View style={[styles.iconWrap, { backgroundColor: hierarchyStyles.company.bg }]}>
                <MaterialCommunityIcons name={hierarchyStyles.company.icon} size={22} color={hierarchyStyles.company.color} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>
                  {item.project_count || 0} Project{item.project_count === 1 ? '' : 's'} • {item.group_count || 0} Group
                  {item.group_count === 1 ? '' : 's'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons name="office-building-outline" size={40} color={colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>
                  {search.trim() ? 'No companies match your search.' : 'Keep your work organized'}
                </Text>
                {!search.trim() ? (
                  <Text style={styles.emptySubtitle}>
                    Add companies and manage projects, groups and tasks in one place.
                  </Text>
                ) : null}
              </View>
            ) : null
          }
        />
      )}

      <BottomNavBar />
    </ScreenContainer>
    </SwipeableTabScreen>
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: 44,
    ...typography.body,
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
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
  emptyState: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
