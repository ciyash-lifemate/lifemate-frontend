import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { colors, radius, reminderTypeStyles, spacing, typography } from '../../src/theme.js';

const TYPES = [
  { key: 'medicine', title: 'Medicine', subtitle: 'Medicine & Health' },
  { key: 'birthday', title: 'Birthday', subtitle: 'Important Birthdays' },
  { key: 'anniversary', title: 'Anniversary', subtitle: 'Special Anniversaries' },
  { key: 'note', title: 'Note', subtitle: 'Notes & Ideas' },
  { key: 'task', title: 'Task', subtitle: 'Tasks & To-Do' },
  { key: 'alarm', title: 'Alarm', subtitle: 'Wake-up & Time Alerts' },
  { key: 'event', title: 'Event / Meeting', subtitle: 'Meetings & Events' },
  { key: 'recharge', title: 'Recharge', subtitle: 'Mobile & DTH Recharge' },
  { key: 'custom', title: 'Others', subtitle: 'Anything Else' },
];

export default function AddReminder() {
  const router = useRouter();
  // Set when opened from Calendar's "+" on a selected day, so the type-
  // specific form below opens pre-filled with that date instead of today.
  const { date } = useLocalSearchParams();

  const handleSelect = (key) => {
    if (key === 'note') {
      router.push('/notes/new');
      return;
    }
    router.push({ pathname: `/reminders/${key}`, params: date ? { date } : {} });
  };

  return (
    <ScreenContainer>
      <Header title="" />
      <View style={styles.titleWrap}>
        <Text style={styles.title}>Add Reminder</Text>
        <Text style={styles.subtitle}>Choose a reminder type</Text>
      </View>

      <FlatList
        data={TYPES}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const type = reminderTypeStyles[item.key];
          return (
            <Pressable style={styles.row} onPress={() => handleSelect(item.key)}>
              <View style={[styles.iconWrap, { backgroundColor: type.bg }]}>
                <MaterialCommunityIcons name={type.icon} size={22} color={type.color} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
});
