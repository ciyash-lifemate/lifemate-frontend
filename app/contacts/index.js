import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, RefreshControl, Alert, Linking, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
// The SDK 57 default export deprecated the function-based API in favor of a
// new class-based one - /legacy keeps the familiar requestPermissionsAsync/
// getContactsAsync/Fields shape this file already uses.
import * as Contacts from 'expo-contacts/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { Avatar } from '../../src/components/Avatar.js';
import { matchContacts, sendNudge, getErrorMessage } from '../../src/api/index.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const AUTO_SYNC_KEY = 'contacts_auto_sync';

export default function LifeMateContacts() {
  const [autoSync, setAutoSync] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [matches, setMatches] = useState([]);
  const [search, setSearch] = useState('');
  const [nudgedIds, setNudgedIds] = useState(new Set());
  // Loads once on mount regardless of the Auto Sync preference - that
  // preference only decides whether *later* focuses re-sync automatically
  // too, matching "Auto Sync is ON" reading as an ongoing behavior rather
  // than gating the very first load.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AUTO_SYNC_KEY).then((v) => setAutoSync(v !== 'false'));
  }, []);

  const runSync = useCallback(async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      setPermissionDenied(false);
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
      const phones = [...new Set(data.flatMap((c) => (c.phoneNumbers || []).map((p) => p.number)).filter(Boolean))];
      const result = await matchContacts(phones);
      setMatches(Array.isArray(result) ? result : []);
    } catch (err) {
      Alert.alert('Sync failed', getErrorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce && !autoSync) return;
      setLoading(true);
      runSync().finally(() => {
        setLoading(false);
        setHasLoadedOnce(true);
      });
      // Deliberately keyed on autoSync/runSync only, not hasLoadedOnce - the
      // first load must always happen once regardless of the preference;
      // hasLoadedOnce is read fresh above rather than listed as a dep so
      // toggling Auto Sync mid-session doesn't itself trigger a re-run.
    }, [autoSync, runSync])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    runSync().finally(() => setRefreshing(false));
  };

  const toggleAutoSync = async () => {
    const next = !autoSync;
    setAutoSync(next);
    await AsyncStorage.setItem(AUTO_SYNC_KEY, String(next));
  };

  const handleNudge = async (userId) => {
    try {
      await sendNudge(userId);
      setNudgedIds((prev) => new Set(prev).add(userId));
    } catch (err) {
      Alert.alert('Could not send', getErrorMessage(err));
    }
  };

  const filtered = matches.filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (m.name || '').toLowerCase().includes(q) || (m.mobile || '').includes(q);
  });

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header title="LifeMate Contacts" />

      <View style={styles.summaryCard}>
        <View style={styles.summaryIconWrap}>
          <Ionicons name="people" size={22} color={colors.primary} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.summaryTitle}>{matches.length} LifeMate users found</Text>
          <Text style={styles.summarySubtitle}>These are your contacts who are using LifeMate.</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {permissionDenied ? (
        <View style={styles.permissionCard}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.permissionText}>
            Contacts access was denied - enable it in Settings to find friends using LifeMate.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permissionBtnText}>Open Settings</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => {
            const isNudged = nudgedIds.has(item.id);
            return (
              <View style={styles.row}>
                <Avatar name={item.name} uri={item.avatar_url} size={44} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.name || 'LifeMate User'}</Text>
                  <Text style={styles.rowSubtitle}>{item.mobile}</Text>
                </View>
                <Pressable hitSlop={10} onPress={() => handleNudge(item.id)} disabled={isNudged}>
                  <Ionicons
                    name={isNudged ? 'checkmark-circle' : 'notifications-outline'}
                    size={22}
                    color={isNudged ? colors.success : colors.primary}
                  />
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.emptyText}>
                {search.trim() ? 'No contacts match your search.' : 'None of your contacts are using LifeMate yet.'}
              </Text>
            ) : null
          }
          ListFooterComponent={
            <Pressable style={styles.autoSyncRow} onPress={toggleAutoSync}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="sync-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Auto Sync is {autoSync ? 'ON' : 'OFF'}</Text>
                <Text style={styles.rowSubtitle}>
                  {autoSync ? 'Contacts are updated automatically' : 'Pull down to refresh manually'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    ...typography.h3,
  },
  summarySubtitle: {
    ...typography.bodyMuted,
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
  permissionCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  permissionText: {
    ...typography.bodyMuted,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  permissionBtnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
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
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
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
  autoSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
