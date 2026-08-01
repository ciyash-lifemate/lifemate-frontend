import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, radius } from '../theme.js';

const LEFT_TABS = [
  { key: 'home', path: '/home', icon: 'home-outline', iconActive: 'home', label: 'Home' },
  { key: 'calendar', path: '/calendar', icon: 'calendar-blank-outline', iconActive: 'calendar', label: 'Calendar' },
];

const RIGHT_TABS = [
  { key: 'companies', path: '/companies', icon: 'domain', iconActive: 'domain', label: 'Company' },
  { key: 'profile', path: '/profile', icon: 'account-outline', iconActive: 'account', label: 'Profile' },
];

const CENTER = { key: 'ai', path: '/ai-chat', icon: 'robot-happy-outline' };

export const BottomNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isTabActive = (tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`);
  const isCenterActive = isTabActive(CENTER);

  const renderTab = (tab) => {
    const isActive = isTabActive(tab);
    return (
      <Pressable key={tab.key} style={styles.tab} onPress={() => router.push(tab.path)}>
        <MaterialCommunityIcons
          name={isActive ? tab.iconActive : tab.icon}
          size={26}
          color={isActive ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 18) }]}>
      {LEFT_TABS.map(renderTab)}

      <View style={styles.centerSlot}>
        <Pressable style={styles.fab} onPress={() => router.push(CENTER.path)}>
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.fabGradient}>
            <MaterialCommunityIcons name={CENTER.icon} size={30} color={colors.white} />
          </LinearGradient>
        </Pressable>
        {isCenterActive ? <View style={styles.centerDot} /> : null}
      </View>

      {RIGHT_TABS.map(renderTab)}
    </View>
  );
};

const FAB_SIZE = 60;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  centerSlot: {
    width: FAB_SIZE + 16,
    alignItems: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radius.pill,
    marginTop: -FAB_SIZE * 0.55,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  centerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
});
