import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme.js';

export const ScreenContainer = ({ children, style, edges = ['top', 'bottom'] }) => (
  <SafeAreaView style={styles.safe} edges={edges}>
    <View style={[styles.container, style]}>{children}</View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
});
