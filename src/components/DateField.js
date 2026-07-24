import { useState } from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, radius, spacing, typography } from '../theme.js';
import { formatClockTime } from '../utils/date.js';

const pad = (n) => String(n).padStart(2, '0');

const formatDate = (date) =>
  date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

// value/onChange use plain strings: "YYYY-MM-DD" for dates, "HH:mm" for times.
export const DateField = ({ label, value, onChange, mode = 'date' }) => {
  const [open, setOpen] = useState(false);

  const dateValue = mode === 'date'
    ? (value ? new Date(`${value}T00:00:00`) : new Date())
    : (() => {
        const d = new Date();
        if (value) {
          const [h, m] = value.split(':').map(Number);
          d.setHours(h, m, 0, 0);
        }
        return d;
      })();

  const displayText = value ? (mode === 'date' ? formatDate(dateValue) : formatClockTime(dateValue)) : 'Select';

  const handleChange = (event, selected) => {
    setOpen(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selected) return;

    if (mode === 'date') {
      onChange(`${selected.getFullYear()}-${pad(selected.getMonth() + 1)}-${pad(selected.getDate())}`);
    } else {
      onChange(`${pad(selected.getHours())}:${pad(selected.getMinutes())}`);
    }
    if (Platform.OS !== 'ios') setOpen(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{displayText}</Text>
        <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={18} color={colors.textSecondary} />
      </Pressable>

      {open && (
        <DateTimePicker value={dateValue} mode={mode} display="default" onChange={handleChange} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyMuted,
    marginBottom: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
  },
  value: {
    ...typography.body,
  },
});
