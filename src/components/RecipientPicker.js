import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Modal, FlatList, Alert, Linking, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
// See app/contacts/index.js for why /legacy - the SDK 57 default export
// dropped the function-based API this uses.
import * as Contacts from 'expo-contacts/legacy';
import { searchUsers, matchContacts, getErrorMessage } from '../api/index.js';
import { Avatar } from './Avatar.js';
import { colors, radius, spacing, typography } from '../theme.js';

// Sharing a personal reminder with too many people at once turns "notify a
// couple of people" into an unintended broadcast - capped by default the
// same way the picker's own chip row is meant to be skimmed at a glance.
// Business contexts (a company's reminder-group members - see
// app/reminder-groups) pass maxRecipients={Infinity} instead, since a real
// team can easily be bigger than that; this cap is meant for the personal
// Quick Add "also remind" picker, not a company roster.
const DEFAULT_MAX_RECIPIENTS = 5;

// Lets a reminder be shared with one or several other app users at once
// (e.g. a Company reminder sent to a colleague, or a whole group) - the
// backend fans the due-reminder push out to everyone selected here in
// addition to the reminder's own owner (see reminder_recipients).
export const RecipientPicker = ({ label = 'Send reminder to', value = [], onChange, maxRecipients = DEFAULT_MAX_RECIPIENTS }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactMatches, setContactMatches] = useState([]);
  const [contactQuery, setContactQuery] = useState('');
  const debounceRef = useRef(null);
  const isUnlimited = !Number.isFinite(maxRecipients);
  const atLimit = !isUnlimited && value.length >= maxRecipients;

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed || atLimit) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Matches by name or mobile number (see user.auth.service.js) - a
        // saved contact's number works here even if its name on the phone
        // doesn't match the person's LifeMate profile name.
        const users = await searchUsers(trimmed);
        setResults(users.filter((u) => !value.some((v) => v.id === u.id)));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, value, atLimit]);

  const addRecipient = (user) => {
    if ((!isUnlimited && value.length >= maxRecipients) || value.some((v) => v.id === user.id)) return;
    onChange([...value, user]);
    setQuery('');
    setResults([]);
  };

  const removeRecipient = (id) => onChange(value.filter((r) => r.id !== id));

  const openContacts = async () => {
    setContactsVisible(true);
    setContactsLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setContactsVisible(false);
        Alert.alert(
          'Contacts access needed',
          'Enable contacts access in Settings to pick a recipient from your phone contacts.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
      const phones = [...new Set(data.flatMap((c) => (c.phoneNumbers || []).map((p) => p.number)).filter(Boolean))];
      const matched = await matchContacts(phones);
      setContactMatches(Array.isArray(matched) ? matched : []);
    } catch (err) {
      setContactsVisible(false);
      Alert.alert('Could not load contacts', getErrorMessage(err));
    } finally {
      setContactsLoading(false);
    }
  };

  const closeContacts = () => {
    setContactsVisible(false);
    setContactQuery('');
  };

  const pickFromContacts = (user) => {
    addRecipient(user);
    closeContacts();
  };

  const filteredContactMatches = contactMatches.filter((m) => {
    if (value.some((v) => v.id === m.id)) return false;
    const q = contactQuery.trim().toLowerCase();
    if (!q) return true;
    return (m.name || '').toLowerCase().includes(q) || (m.mobile || '').includes(q);
  });

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {value.length ? (
        <View style={styles.chipRow}>
          {value.map((r) => (
            <View key={r.id} style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {r.name}
              </Text>
              <Pressable onPress={() => removeRecipient(r.id)} hitSlop={8}>
                <Ionicons name="close" size={14} color={colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {atLimit ? (
        <Text style={styles.limitText}>Maximum {maxRecipients} people - remove someone to add another.</Text>
      ) : (
        <>
          <View style={styles.field}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Search by name or mobile number"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              keyboardType="default"
            />
            {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <Pressable onPress={openContacts} hitSlop={8} style={styles.contactsBtn}>
              <Ionicons name="people" size={20} color={colors.primary} />
            </Pressable>
          </View>

          {results.length ? (
            <View style={styles.results}>
              {results.map((user) => (
                <Pressable key={user.id} style={styles.resultRow} onPress={() => addRecipient(user)}>
                  <Text style={styles.resultText}>{user.name}</Text>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}

      <Text style={styles.hint}>
        Everyone added here also gets a notification when this reminder is due - great for sharing a follow-up with a
        colleague or a whole group at once.
        {isUnlimited ? '' : ` Up to ${maxRecipients} people.`}
      </Text>

      <Modal visible={contactsVisible} transparent animationType="slide" onRequestClose={closeContacts}>
        <Pressable style={styles.backdrop} onPress={closeContacts}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Your Contacts on LifeMate</Text>
              <Pressable onPress={closeContacts} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {contactsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.sheetLoading} />
            ) : (
              <>
                <View style={styles.sheetSearchField}>
                  <Ionicons name="search" size={16} color={colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Search your contacts"
                    placeholderTextColor={colors.textMuted}
                    value={contactQuery}
                    onChangeText={setContactQuery}
                  />
                </View>
                <FlatList
                  data={filteredContactMatches}
                  keyExtractor={(item) => String(item.id)}
                  style={styles.sheetList}
                  renderItem={({ item }) => (
                    <Pressable style={styles.contactRow} onPress={() => pickFromContacts(item)}>
                      <Avatar name={item.name} uri={item.avatar_url} size={40} />
                      <View style={styles.contactBody}>
                        <Text style={styles.resultText}>{item.name || 'LifeMate User'}</Text>
                        <Text style={styles.contactMobile}>{item.mobile}</Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                    </Pressable>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      None of your contacts are using LifeMate yet.
                    </Text>
                  }
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyMuted,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    maxWidth: 180,
  },
  chipText: {
    ...typography.bodyMuted,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
  },
  contactsBtn: {
    paddingLeft: spacing.xs,
  },
  results: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultText: {
    ...typography.body,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  limitText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
    maxHeight: '75%',
    paddingBottom: spacing.lg,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sheetTitle: {
    ...typography.h3,
  },
  sheetLoading: {
    marginVertical: spacing.xl,
  },
  sheetSearchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetList: {
    paddingHorizontal: spacing.lg,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactBody: {
    flex: 1,
  },
  contactMobile: {
    ...typography.caption,
    marginTop: 2,
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
  },
});
