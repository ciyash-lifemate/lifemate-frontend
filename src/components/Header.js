import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, spacing, typography } from '../theme.js';

export const Header = ({ title, right, onBack }) => {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <Pressable onPress={onBack || (() => router.back())} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h3,
  },
  right: {
    minWidth: 26,
    alignItems: 'flex-end',
  },
});
