import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Modal, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { TextField } from '../src/components/TextField.js';
import { Button } from '../src/components/Button.js';
import { getFitnessLog, saveFitnessLog, listFitnessDates, getErrorMessage } from '../src/api/index.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const pad = (n) => String(n).padStart(2, '0');
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => toKey(new Date());
const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const mondayOf = (d) => {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const MOODS = [
  { key: 'lazy', emoji: '😴', label: 'Lazy' },
  { key: 'average', emoji: '😐', label: 'Average' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'great', emoji: '😀', label: 'Great' },
  { key: 'excellent', emoji: '🔥', label: 'Excellent' },
];

const ACTIVITY_FIELDS = [
  { key: 'steps', label: 'Steps', unit: 'steps', icon: 'shoe-print', color: colors.success, bg: '#E7F8ED' },
  { key: 'calories', label: 'Calories', unit: 'kcal', icon: 'fire', color: colors.warning, bg: '#FDF3E1' },
  { key: 'workoutMinutes', label: 'Workout Time', unit: 'min', icon: 'clock-outline', color: colors.blue, bg: '#E0F2FE' },
  { key: 'activeCalories', label: 'Active Calories', unit: 'kcal', icon: 'heart', color: colors.danger, bg: '#FDE9E9' },
  { key: 'distanceKm', label: 'Distance', unit: 'km', icon: 'map-marker-outline', color: colors.primary, bg: colors.primaryLight },
  { key: 'floorsClimbed', label: 'Floors Climbed', unit: 'floors', icon: 'stairs', color: '#0F766E', bg: '#E1F4F1' },
];

const HEALTH_FIELDS = [
  { key: 'weightKg', label: 'Weight', unit: 'kg', icon: 'scale-bathroom', color: colors.success, bg: '#E7F8ED' },
  { key: 'bodyFatPercent', label: 'Body Fat', unit: '%', icon: 'percent-outline', color: colors.warning, bg: '#FDF3E1' },
  { key: 'waterIntakeLiters', label: 'Water Intake', unit: 'L', icon: 'water-outline', color: colors.blue, bg: '#E0F2FE' },
  { key: 'sleepHours', label: 'Sleep', unit: 'hrs', icon: 'power-sleep', color: colors.primary, bg: colors.primaryLight },
];

const numericOnly = (v) => v.replace(/[^0-9.]/g, '');
const toNumberOrNull = (v) => (v === '' || v == null ? null : Number(v));

const blankExercise = { name: '', durationMinutes: '', calories: '', distanceKm: '' };

export default function AddFitness() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [dotDates, setDotDates] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [mood, setMood] = useState(null);
  const [activity, setActivity] = useState({});
  const [exercises, setExercises] = useState([]);
  const [health, setHealth] = useState({});
  const [notes, setNotes] = useState('');
  // { index, name, durationMinutes, calories, distanceKm } while open,
  // index is null for a new exercise and the array index while editing one.
  const [exerciseModal, setExerciseModal] = useState(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const loadDots = useCallback(async () => {
    try {
      const dates = await listFitnessDates(toKey(weekDays[0]), toKey(weekDays[6]));
      setDotDates(new Set(Array.isArray(dates) ? dates : []));
    } catch {
      // Best-effort - the day-strip just shows no dots this pass.
    }
  }, [weekStart]);

  // A fetch that's still in flight when the user starts typing (Render's
  // free-tier latency, or React dev-mode's double-invoked effects) used to
  // land afterwards and silently wipe out whatever they'd already entered -
  // markDirty() flags that an edit has happened since the current load
  // started, so its result gets dropped instead of clobbering the form.
  const loadRequestRef = useRef(0);
  const dirtyRef = useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };

  const loadDay = useCallback(async (date) => {
    const requestId = ++loadRequestRef.current;
    dirtyRef.current = false;
    setLoading(true);
    try {
      const log = await getFitnessLog(date);
      if (loadRequestRef.current !== requestId || dirtyRef.current) return;
      setMood(log.mood || null);
      setActivity({
        steps: log.steps ?? '',
        calories: log.calories ?? '',
        workoutMinutes: log.workout_minutes ?? '',
        activeCalories: log.active_calories ?? '',
        distanceKm: log.distance_km ?? '',
        floorsClimbed: log.floors_climbed ?? '',
      });
      setExercises(Array.isArray(log.exercises) ? log.exercises : []);
      setHealth({
        weightKg: log.weight_kg ?? '',
        bodyFatPercent: log.body_fat_percent ?? '',
        waterIntakeLiters: log.water_intake_liters ?? '',
        sleepHours: log.sleep_hours ?? '',
      });
      setNotes(log.notes || '');
    } catch {
      if (loadRequestRef.current !== requestId || dirtyRef.current) return;
      setMood(null);
      setActivity({});
      setExercises([]);
      setHealth({});
      setNotes('');
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDots();
  }, [loadDots]);

  // Plain useEffect keyed on selectedDate, not useFocusEffect - this is a
  // data-entry form, not a read screen. useFocusEffect would re-fetch (and
  // silently wipe out whatever the user had typed but not saved yet) on
  // *any* focus-regain, not just an actual day switch - e.g. the dev client's
  // menu overlay stealing and returning focus while someone is mid-edit.
  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  const shiftWeek = (delta) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta * 7);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveFitnessLog(selectedDate, {
        mood,
        steps: toNumberOrNull(activity.steps),
        calories: toNumberOrNull(activity.calories),
        workoutMinutes: toNumberOrNull(activity.workoutMinutes),
        activeCalories: toNumberOrNull(activity.activeCalories),
        distanceKm: toNumberOrNull(activity.distanceKm),
        floorsClimbed: toNumberOrNull(activity.floorsClimbed),
        weightKg: toNumberOrNull(health.weightKg),
        bodyFatPercent: toNumberOrNull(health.bodyFatPercent),
        waterIntakeLiters: toNumberOrNull(health.waterIntakeLiters),
        sleepHours: toNumberOrNull(health.sleepHours),
        exercises: exercises.map((ex) => ({
          name: ex.name,
          durationMinutes: toNumberOrNull(String(ex.durationMinutes ?? '')),
          calories: toNumberOrNull(String(ex.calories ?? '')),
          distanceKm: toNumberOrNull(String(ex.distanceKm ?? '')),
        })),
        notes: notes.trim() || undefined,
      });
      loadDots();
      // Re-read from the server rather than trusting local state after a
      // save - the previous silent-save-with-no-confirmation made it
      // impossible to tell whether a save had actually landed.
      await loadDay(selectedDate);
      Alert.alert('Saved', 'Fitness data saved for this day.');
    } catch (err) {
      Alert.alert('Could not save', getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openAddExercise = () => setExerciseModal({ index: null, ...blankExercise });
  const openEditExercise = (index) => {
    const ex = exercises[index];
    setExerciseModal({
      index,
      name: ex.name || '',
      durationMinutes: ex.durationMinutes != null ? String(ex.durationMinutes) : '',
      calories: ex.calories != null ? String(ex.calories) : '',
      distanceKm: ex.distanceKm != null ? String(ex.distanceKm) : '',
    });
  };
  const deleteExercise = (index) => {
    markDirty();
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const saveExerciseModal = () => {
    if (!exerciseModal.name.trim()) {
      Alert.alert('Name required', 'Please enter an exercise name.');
      return;
    }
    const entry = {
      name: exerciseModal.name.trim(),
      durationMinutes: toNumberOrNull(exerciseModal.durationMinutes),
      calories: toNumberOrNull(exerciseModal.calories),
      distanceKm: toNumberOrNull(exerciseModal.distanceKm),
    };
    markDirty();
    setExercises((prev) =>
      exerciseModal.index == null ? [...prev, entry] : prev.map((e, i) => (i === exerciseModal.index ? entry : e))
    );
    setExerciseModal(null);
  };

  const renderMetricGrid = (fields, values, setValues) => (
    <View style={styles.metricsGrid}>
      {fields.map((f) => (
        <View key={f.key} style={styles.metricTile}>
          <View style={[styles.metricIconWrap, { backgroundColor: f.bg }]}>
            <MaterialCommunityIcons name={f.icon} size={18} color={f.color} />
          </View>
          <Text style={styles.metricLabel}>{f.label}</Text>
          <View style={styles.metricValueRow}>
            <TextInput
              style={styles.metricInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={String(values[f.key] ?? '')}
              onChangeText={(v) => {
                markDirty();
                setValues((prev) => ({ ...prev, [f.key]: numericOnly(v) }));
              }}
            />
            <Text style={styles.metricUnit}>{f.unit}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Add Fitness</Text>
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving} hitSlop={6}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.dayStripRow}>
            <Pressable onPress={() => shiftWeek(-1)} hitSlop={10}>
              <Ionicons name="chevron-back" size={18} color={colors.primary} />
            </Pressable>
            {weekDays.map((d) => {
              const key = toKey(d);
              const isSelected = key === selectedDate;
              const hasData = dotDates.has(key);
              return (
                <Pressable key={key} style={styles.dayCell} onPress={() => setSelectedDate(key)}>
                  <View style={[styles.dayPill, isSelected && styles.dayPillActive]}>
                    <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>
                      {WEEKDAY_LABEL[d.getDay()]}
                    </Text>
                    <Text style={[styles.dayNumber, isSelected && styles.dayNumberActive]}>{pad(d.getDate())}</Text>
                  </View>
                  {hasData ? <View style={[styles.dayDot, isSelected && styles.dayDotActive]} /> : null}
                </Pressable>
              );
            })}
            <Pressable onPress={() => shiftWeek(1)} hitSlop={10}>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Loading…</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>How was your day?</Text>
              <View style={styles.moodRow}>
                {MOODS.map((m) => (
                  <Pressable
                    key={m.key}
                    style={[styles.moodItem, mood === m.key && styles.moodItemActive]}
                    onPress={() => {
                      markDirty();
                      setMood(m.key);
                    }}
                  >
                    <Text style={styles.moodEmoji}>{m.emoji}</Text>
                    <Text style={[styles.moodLabel, mood === m.key && styles.moodLabelActive]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activity Summary</Text>
              {renderMetricGrid(ACTIVITY_FIELDS, activity, setActivity)}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Workout Details</Text>
                <Pressable style={styles.addExerciseBtn} onPress={openAddExercise} hitSlop={8}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.addExerciseText}>Add Exercise</Text>
                </Pressable>
              </View>
              {exercises.length === 0 ? (
                <Text style={styles.emptyText}>No exercises logged yet.</Text>
              ) : (
                exercises.map((ex, index) => (
                  <View key={index} style={styles.exerciseRow}>
                    <View style={styles.exerciseIconWrap}>
                      <MaterialCommunityIcons name="dumbbell" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.exerciseBody}>
                      <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
                      <View style={styles.exerciseMetaRow}>
                        {ex.durationMinutes != null ? (
                          <Text style={styles.exerciseMetaText}>{ex.durationMinutes} min</Text>
                        ) : null}
                        {ex.distanceKm != null ? (
                          <Text style={styles.exerciseMetaText}>{ex.distanceKm} km</Text>
                        ) : null}
                        {ex.calories != null ? (
                          <Text style={styles.exerciseMetaText}>{ex.calories} kcal</Text>
                        ) : null}
                      </View>
                    </View>
                    <Pressable hitSlop={8} onPress={() => openEditExercise(index)} style={styles.exerciseActionBtn}>
                      <Ionicons name="pencil" size={16} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => deleteExercise(index)} style={styles.exerciseActionBtn}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Health Metrics</Text>
              {renderMetricGrid(HEALTH_FIELDS, health, setHealth)}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="How do you feel today? Any notes..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={(v) => {
                  markDirty();
                  setNotes(v.slice(0, 200));
                }}
                multiline
                maxLength={200}
              />
              <Text style={styles.notesCounter}>{notes.length}/200</Text>
            </View>

            <Button
              title="Save Fitness Data"
              onPress={handleSave}
              loading={saving}
              style={styles.saveFullBtn}
            />
          </>
        )}
      </ScrollView>

      <Modal visible={!!exerciseModal} transparent animationType="slide" onRequestClose={() => setExerciseModal(null)}>
        <Pressable style={styles.backdrop} onPress={() => setExerciseModal(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            {exerciseModal ? (
              <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
                <Text style={styles.sheetTitle}>
                  {exerciseModal.index == null ? 'Add Exercise' : 'Edit Exercise'}
                </Text>
                <TextField
                  label="Exercise Name"
                  placeholder="Running"
                  value={exerciseModal.name}
                  onChangeText={(v) => setExerciseModal((prev) => ({ ...prev, name: v }))}
                />
                <TextField
                  label="Duration (min)"
                  placeholder="30"
                  keyboardType="numeric"
                  value={exerciseModal.durationMinutes}
                  onChangeText={(v) => setExerciseModal((prev) => ({ ...prev, durationMinutes: numericOnly(v) }))}
                />
                <TextField
                  label="Calories (kcal)"
                  placeholder="250"
                  keyboardType="numeric"
                  value={exerciseModal.calories}
                  onChangeText={(v) => setExerciseModal((prev) => ({ ...prev, calories: numericOnly(v) }))}
                />
                <TextField
                  label="Distance (km)"
                  placeholder="6.0"
                  keyboardType="numeric"
                  value={exerciseModal.distanceKm}
                  onChangeText={(v) => setExerciseModal((prev) => ({ ...prev, distanceKm: numericOnly(v) }))}
                />
                <Button title="Save Exercise" onPress={saveExerciseModal} />
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  saveBtnText: {
    ...typography.bodyMuted,
    color: colors.white,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  dayStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayCell: {
    alignItems: 'center',
  },
  dayPill: {
    width: 40,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  dayPillActive: {
    backgroundColor: colors.primary,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dayLabelActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  dayNumber: {
    ...typography.body,
    fontWeight: '700',
    marginTop: 2,
  },
  dayNumberActive: {
    color: colors.white,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  dayDotActive: {
    backgroundColor: colors.primary,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginHorizontal: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moodItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodLabel: {
    ...typography.caption,
    marginTop: 4,
  },
  moodLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricTile: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  metricIconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  metricLabel: {
    ...typography.caption,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  metricInput: {
    ...typography.h3,
    padding: 0,
    minWidth: 20,
  },
  metricUnit: {
    ...typography.caption,
    marginLeft: 4,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addExerciseText: {
    ...typography.bodyMuted,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: 2,
  },
  emptyText: {
    ...typography.bodyMuted,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  exerciseBody: {
    flex: 1,
  },
  exerciseName: {
    ...typography.body,
    fontWeight: '600',
  },
  exerciseMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  exerciseMetaText: {
    ...typography.caption,
  },
  exerciseActionBtn: {
    marginLeft: spacing.sm,
  },
  notesInput: {
    ...typography.body,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  notesCounter: {
    ...typography.caption,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  saveFullBtn: {
    marginTop: spacing.sm,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '85%',
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
});
