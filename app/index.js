import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, typography, spacing } from '../src/theme.js';

export default function Splash() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Brief brand flash only - this used to be 900ms stacked ON TOP of
    // however long the actual auth check (getMe()/token read) took, making
    // every cold start feel slower than it needed to.
    const timer = setTimeout(() => {
      if (user) {
        router.replace(user.is_profile_complete ? '/home' : '/create-profile');
      } else {
        router.replace('/onboarding');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isLoading, user]);

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name="robot-happy-outline" size={56} color={colors.primary} />
      </View>
      <Text style={styles.title}>LifeMate</Text>
      <Text style={styles.tagline}>Remember Everything.{'\n'}Live Better.</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.body,
    color: colors.white,
    opacity: 0.85,
    textAlign: 'center',
  },
});
