import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, radius } from '../theme.js';

const TABS = [
  { key: 'home', path: '/home', icon: 'home-outline', iconActive: 'home' },
  { key: 'ai', path: '/ai-chat', icon: 'robot-outline', iconActive: 'robot' },
  { key: 'notes', path: '/notes', icon: 'note-text-outline', iconActive: 'note-text' },
  { key: 'calendar', path: '/calendar', icon: 'calendar-blank-outline', iconActive: 'calendar' },
];

const FAB = { key: 'add', path: '/reminders/add', icon: 'plus' };

export const BottomNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {TABS.map((tab) => {
        const isActive = pathname === tab.path || pathname.startsWith(`${tab.path}/`);

        return (
          <Pressable key={tab.key} style={styles.tab} onPress={() => router.push(tab.path)}>
            <MaterialCommunityIcons
              name={isActive ? tab.iconActive : tab.icon}
              size={24}
              color={isActive ? colors.primary : colors.textMuted}
            />
          </Pressable>
        );
      })}

      <Pressable style={styles.fab} onPress={() => router.push(FAB.path)}>
        <MaterialCommunityIcons name={FAB.icon} size={28} color={colors.white} />
      </Pressable>
    </View>
  );
};

const FAB_SIZE = 52;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    position: 'relative',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    top: -FAB_SIZE - 12,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
