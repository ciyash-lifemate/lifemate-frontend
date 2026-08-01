import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, Modal, Alert, StyleSheet } from 'react-native';
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

// How many projects the details screen previews before handing off to the
// dedicated "Projects under Company" list (see app/companies/[id]/projects.js) -
// a details page showing every project inline stops reading as a summary
// once a company has more than a handful.
const PROJECT_PREVIEW_LIMIT = 3;

const formatCreatedOn = (value) => {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const StatCell = ({ icon, label, value }) => (
  <View style={styles.statCell}>
    <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
    <View style={styles.statCellText}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  </View>
);

export default function CompanyDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [company, setCompany] = useState(null);
  const [projects, setProjects] = useState([]);
  const [editing, setEditing] = useState(isNew);
  const [menuVisible, setMenuVisible] = useState(false);
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
        const data = await getCompany(id);
        setCompany(data);
        setName(data.name || '');
        setNotes(data.notes || '');
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
        const created = await createCompany({ name: name.trim(), notes: notes.trim() || undefined });
        router.replace(`/companies/${created.id}`);
      } else {
        const updated = await updateCompany(id, { name: name.trim(), notes: notes.trim() });
        setCompany(updated);
        setEditing(false);
      }
    } catch (err) {
      Alert.alert('Could not save company', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
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

  const previewProjects = projects.slice(0, PROJECT_PREVIEW_LIMIT);

  return (
    <ScreenContainer>
      <Header
        title=""
        right={
          !isNew ? (
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={12}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
            </Pressable>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <View style={[styles.iconCircle, { backgroundColor: hierarchyStyles.company.bg }]}>
            <MaterialCommunityIcons name={hierarchyStyles.company.icon} size={36} color={hierarchyStyles.company.color} />
          </View>
          {!isNew ? (
            <Pressable style={styles.editBadge} onPress={() => setEditing((v) => !v)} hitSlop={8}>
              <Ionicons name="pencil" size={13} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {isNew || editing ? (
          <>
            <TextField label="Company Name" placeholder="Acme Pvt Ltd" value={name} onChangeText={setName} voiceInput />
            <TextField
              label="Description (optional)"
              placeholder="What this company is about"
              value={notes}
              onChangeText={setNotes}
              multiline
              style={styles.notesInput}
            />
            <Button title={isNew ? 'Create Company' : 'Save Changes'} onPress={handleSave} loading={loading} style={styles.submit} />
          </>
        ) : (
          <>
            <Text style={styles.name}>{name}</Text>
            <Pressable onPress={() => setEditing(true)}>
              <Text style={styles.description}>{notes || 'Add company description...'}</Text>
            </Pressable>

            <View style={styles.statsGrid}>
              <StatCell icon="folder-outline" label="Total Projects" value={company?.project_count || 0} />
              <StatCell icon="account-group-outline" label="Total Groups" value={company?.group_count || 0} />
              <StatCell icon="account-multiple-outline" label="Members" value={company?.member_count || 0} />
              <StatCell icon="calendar-outline" label="Created On" value={formatCreatedOn(company?.created_at)} />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Projects</Text>
              <Pressable onPress={() => router.push({ pathname: '/projects/new', params: { companyId: id } })}>
                <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              </Pressable>
            </View>

            <FlatList
              data={previewProjects}
              keyExtractor={(item) => String(item.id)}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => router.push(`/projects/${item.id}`)}>
                  <View style={[styles.rowIconWrap, { backgroundColor: hierarchyStyles.project.bg }]}>
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
              ListEmptyComponent={<Text style={styles.emptyText}>No projects yet. Tap + to add one.</Text>}
            />

            {projects.length > PROJECT_PREVIEW_LIMIT ? (
              <Pressable style={styles.viewAllRow} onPress={() => router.push(`/companies/${id}/projects`)}>
                <Text style={styles.viewAllText}>View All Projects ({projects.length})</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Company Options</Text>
            <Pressable
              style={styles.sheetRow}
              onPress={() => {
                setMenuVisible(false);
                setEditing(true);
              }}
            >
              <Ionicons name="pencil-outline" size={20} color={colors.text} />
              <Text style={styles.sheetRowText}>Edit Company</Text>
            </Pressable>
            <Pressable style={styles.sheetRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
              <Text style={[styles.sheetRowText, styles.sheetRowDanger]}>Delete Company</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  avatarWrap: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  name: {
    ...typography.h2,
    textAlign: 'center',
  },
  description: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  statCell: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statCellText: {
    flex: 1,
  },
  statLabel: {
    ...typography.caption,
  },
  statValue: {
    ...typography.body,
    fontWeight: '700',
    marginTop: 1,
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
    gap: spacing.md,
  },
  rowIconWrap: {
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
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
  },
  viewAllText: {
    ...typography.bodyMuted,
    color: colors.primary,
    fontWeight: '600',
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.h3,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sheetRowText: {
    ...typography.body,
    fontWeight: '600',
  },
  sheetRowDanger: {
    color: colors.danger,
  },
});
