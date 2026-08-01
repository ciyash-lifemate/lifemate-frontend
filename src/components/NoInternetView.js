import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../theme.js';

// Shown instead of a screen's usual content when its data failed to load
// because there's no network at all (not a server error - see each
// screen's own load() for how it tells the two apart) - the same idea as
// YouTube/most apps showing an explicit "no connection" state rather than
// a misleading empty list that reads as "you have nothing" when the real
// story is "couldn't check."
export const NoInternetView = ({ onRetry, retrying, title = 'No Internet Connection', subtitle = 'Check your connection and try again.' }) => (
  <View style={styles.container}>
    <View style={styles.iconWrap}>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
    </View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
    <Pressable style={styles.retryBtn} onPress={onRetry} disabled={retrying}>
      <Ionicons name="refresh" size={16} color={colors.white} />
      <Text style={styles.retryText}>{retrying ? 'Retrying…' : 'Retry'}</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});
