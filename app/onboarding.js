import { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { Button } from '../src/components/Button.js';
import { colors, typography, spacing } from '../src/theme.js';

const SLIDES = [
  {
    icon: 'robot-happy-outline',
    title: 'Welcome to\nLifeMate',
    subtitle: 'Your AI Powered\nLife Assistant',
  },
  {
    icon: 'bell-ring-outline',
    title: 'Never Miss\nWhat Matters',
    subtitle: 'Medicine, birthdays, tasks\nand more - all in one place',
  },
  {
    icon: 'chat-processing-outline',
    title: 'Just Ask,\nWe Remember',
    subtitle: 'Tell your AI assistant what\nto remember in plain words',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const goToLogin = () => router.replace('/login');

  const handleNext = () => {
    if (index === SLIDES.length - 1) {
      goToLogin();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };

  return (
    <ScreenContainer>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name={slide.icon} size={64} color={colors.primary} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Button title={index === SLIDES.length - 1 ? 'Get Started' : 'Next'} onPress={handleNext} />
        <Text style={styles.skip} onPress={goToLogin}>
          Skip
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyMuted,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  skip: {
    ...typography.bodyMuted,
    marginTop: spacing.md,
  },
});
