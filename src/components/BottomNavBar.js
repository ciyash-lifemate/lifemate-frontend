import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, radius } from '../theme.js';

const TABS = [
  { key: 'home', path: '/home', icon: 'home-outline', iconActive: 'home' },
  { key: 'ai', path: '/ai-chat', icon: 'robot-outline', iconActive: 'robot' },
  { key: 'add', path: '/reminders/add', icon: 'plus', isFab: true },
  { key: 'calendar', path: '/calendar', icon: 'calendar-blank-outline', iconActive: 'calendar' },
  { key: 'chats', path: '/chats', icon: 'chat-outline', iconActive: 'chat' },
];

export const BottomNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {TABS.map((tab) => {
        const isActive = pathname === tab.path || pathname.startsWith(`${tab.path}/`);

        if (tab.isFab) {
          return (
            <Pressable key={tab.key} style={styles.fab} onPress={() => router.push(tab.path)}>
              <MaterialCommunityIcons name={tab.icon} size={28} color={colors.white} />
            </Pressable>
          );
        }

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
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
