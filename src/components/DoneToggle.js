import { Pressable, View, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme.js';

// A bolder done/not-done circle, shared by every checklist item and
// "mark as done" control in the app. Done = filled circle + checkmark;
// not-done = a genuinely thick ring rather than a thin outline, so at a
// glance it doesn't read as a faint radio button. `onPress` is optional -
// omit it for a read-only display (e.g. a checklist item shown inside a
// detail card that isn't itself editable there).
export const DoneToggle = ({ done, onPress, size = 24, color = colors.success, offColor = colors.textMuted }) => {
  const content = done ? (
    <Ionicons name="checkmark-circle" size={size} color={color} />
  ) : (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: offColor }]} />
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2.5,
  },
});
