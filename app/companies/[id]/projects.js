import { useCallback, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../../src/components/ScreenContainer.js';
import { getCompany, listProjects } from '../../../src/api/index.js';
import { colors, hierarchyStyles, radius, spacing, typography } from '../../../src/theme.js';

export default function CompanyProjectsList() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [company, setCompany] = useState(null);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [companyData, projectsData] = await Promise.all([getCompany(id), listProjects(id)]);
      setCompany(companyData);
      setProjects(projectsData || []);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Projects</Text>
        <Pressable onPress={() => router.push({ pathname: '/projects/new', params: { companyId: id } })} hitSlop={10}>
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </Pressable>
      </View>

      {company ? (
        <View style={styles.companyRow}>
          <View style={[styles.iconWrap, { backgroundColor: hierarchyStyles.company.bg }]}>
            <MaterialCommunityIcons name={hierarchyStyles.company.icon} size={20} color={hierarchyStyles.company.color} />
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.companyMeta}>
              {company.project_count || 0} Project{company.project_count === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/projects/${item.id}`)}>
            <View style={[styles.iconWrap, { backgroundColor: hierarchyStyles.project.bg }]}>
              <MaterialCommunityIcons name={hierarchyStyles.project.icon} size={20} color={hierarchyStyles.project.color} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.rowSubtitle}>
                {item.group_count || 0} Group{item.group_count === 1 ? '' : 's'} • {item.task_count || 0} Task
                {item.task_count === 1 ? '' : 's'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {search.trim() ? 'No projects match your search.' : 'No projects yet. Tap + to add one.'}
            </Text>
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
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  companyName: {
    ...typography.body,
    fontWeight: '700',
  },
  companyMeta: {
    ...typography.caption,
    marginTop: 2,
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
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
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
