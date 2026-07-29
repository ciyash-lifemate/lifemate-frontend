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
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  listProjects,
  getErrorMessage,
} from '../../src/api/index.js';
import { colors, hierarchyStyles, radius, spacing, typography } from '../../src/theme.js';

export default function CompanyDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!isNew);

  const loadProjects = useCallback(async () => {
    if (isNew) return;
    try {
      setProjects(await listProjects(id));
    } catch {
      setProjects([]);
    }
  }, [id, isNew]);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const company = await getCompany(id);
        setName(company.name || '');
        setNotes(company.notes || '');
      } catch {
        Alert.alert('Could not load company', 'Please try again.');
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [id, isNew]);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a company name.');
      return;
    }
    setLoading(true);
    try {
      if (isNew) {
        const company = await createCompany({ name: name.trim(), notes: notes.trim() || undefined });
        router.replace(`/companies/${company.id}`);
      } else {
        await updateCompany(id, { name: name.trim(), notes: notes.trim() });
      }
    } catch (err) {
      Alert.alert('Could not save company', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete company', `Delete "${name}"? Its projects, groups and reminders will be removed too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCompany(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete company', getErrorMessage(err));
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
            <Pressable onPress={handleDelete} hitSlop={12}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{isNew ? 'New Company' : name}</Text>

        <TextField label="Company Name" placeholder="Acme Pvt Ltd" value={name} onChangeText={setName} voiceInput />
        <TextField
          label="Notes (optional)"
          placeholder="What this company is about"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={styles.notesInput}
        />

        <Button title="Save Company" onPress={handleSave} loading={loading} style={styles.submit} />

        {!isNew ? (
          <View style={styles.projectsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Projects</Text>
              <Pressable onPress={() => router.push({ pathname: '/projects/new', params: { companyId: id } })}>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              </Pressable>
            </View>

            <FlatList
              data={projects}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => router.push(`/projects/${item.id}`)}>
                  <View style={[styles.iconWrap, { backgroundColor: hierarchyStyles.project.bg }]}>
                    <MaterialCommunityIcons name={hierarchyStyles.project.icon} size={20} color={hierarchyStyles.project.color} />
                  </View>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No projects yet. Tap + to add one.</Text>}
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
  projectsSection: {
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
