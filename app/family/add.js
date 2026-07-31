import { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Header } from '../../src/components/Header.js';
import { TextField } from '../../src/components/TextField.js';
import { Button } from '../../src/components/Button.js';
import { getFamilyGroup, createFamilyGroup, inviteFamilyMember, getErrorMessage } from '../../src/api/index.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const STEP_LABELS = ['Invite', 'Permissions', 'Done'];

// Must match how login.js stores a number at signup (+91 followed by 10
// bare digits, no spaces) - inviteMember does an exact `mobile = ?` match on
// the backend, so this form's own "+91 98765 43210" placeholder was
// actively misleading: typing it back with spaces (or without +91, the way
// most people would naturally type a 10-digit number) never matched the
// stored value, so a real LifeMate account came back "not found" and the
// whole create-group-and-invite flow failed on step 2 every time.
const normalizeMobile = (raw) => {
  const digits = raw.replace(/\D/g, '');
  const last10 = digits.length > 10 ? digits.slice(-10) : digits;
  return `+91${last10}`;
};

const PERMISSION_OPTIONS = [
  { key: 'view', icon: 'eye-outline', label: 'View only', desc: 'Can view reminders and events only' },
  { key: 'edit', icon: 'pencil-outline', label: 'Can edit', desc: 'Can view, edit and complete reminders' },
  { key: 'add', icon: 'add-circle-outline', label: 'Can add', desc: 'Can add new reminders and events' },
  { key: 'full', icon: 'ribbon-outline', label: 'Full access', desc: 'Can view, edit, add and manage everything' },
];

export default function AddFamilyMember() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mobile, setMobile] = useState('');
  const [permission, setPermission] = useState('view');
  const [loading, setLoading] = useState(false);
  const [addedName, setAddedName] = useState('');

  const handleSendInvite = () => {
    if (mobile.replace(/\D/g, '').length < 10) {
      Alert.alert('Phone number required', "Enter the family member's 10-digit phone number.");
      return;
    }
    setStep(1);
  };

  const handleConfirmPermission = async () => {
    setLoading(true);
    try {
      let group = await getFamilyGroup();
      if (!group) group = await createFamilyGroup('My Family');
      const beforeIds = new Set((group.members || []).map((m) => String(m.user_id)));
      const updated = await inviteFamilyMember(normalizeMobile(mobile), permission);
      const newMember = updated.members?.find((m) => !beforeIds.has(String(m.user_id))) || {};
      setAddedName(newMember.name || 'Family member');
      setStep(2);
    } catch (err) {
      Alert.alert('Could not add member', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <Header title="Add Family Member" />

      <View style={styles.stepRow}>
        {STEP_LABELS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={styles.stepConnectorRow}>
              {i > 0 ? <View style={[styles.stepLine, i <= step && styles.stepLineActive]} /> : null}
              <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                {i < step ? (
                  <Ionicons name="checkmark" size={14} color={colors.white} />
                ) : (
                  <Text style={[styles.stepDotText, i <= step && styles.stepDotTextActive]}>{i + 1}</Text>
                )}
              </View>
              {i < STEP_LABELS.length - 1 ? <View style={[styles.stepLine, i < step && styles.stepLineActive]} /> : null}
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.content}>
        {step === 0 ? (
          <View style={styles.centerBlock}>
            <View style={styles.envelopeWrap}>
              <Ionicons name="mail-outline" size={48} color={colors.primary} />
              <View style={styles.envelopeHeart}>
                <Ionicons name="heart" size={16} color={colors.pink} />
              </View>
            </View>
            <Text style={styles.stepTitle}>Invite Family Member</Text>
            <Text style={styles.stepSubtitle}>Add by phone number</Text>

            <TextField
              placeholder="Phone number (e.g. 98765 43210)"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              containerStyle={styles.fullWidth}
            />

            <Button title="Continue" onPress={handleSendInvite} style={styles.fullWidth} />

            <View style={styles.hintRow}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.hintText}>
                They must already have a LifeMate account with this number (+91, same as you logged in with).
              </Text>
            </View>
          </View>
        ) : step === 1 ? (
          <View>
            <Text style={styles.sectionTitle}>What can they do?</Text>
            {PERMISSION_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.permissionRow, permission === opt.key && styles.permissionRowActive]}
                onPress={() => setPermission(opt.key)}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={permission === opt.key ? colors.primary : colors.textSecondary}
                />
                <View style={styles.permissionTextWrap}>
                  <Text style={styles.permissionLabel}>{opt.label}</Text>
                  <Text style={styles.permissionDesc}>{opt.desc}</Text>
                </View>
                <View style={[styles.radio, permission === opt.key && styles.radioActive]}>
                  {permission === opt.key ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            ))}
            <Button title="Continue" onPress={handleConfirmPermission} loading={loading} style={styles.submitBtn} />
          </View>
        ) : (
          <View style={styles.centerBlock}>
            <View style={styles.doneIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={styles.stepTitle}>{addedName} added!</Text>
            <Text style={styles.stepSubtitle}>They've been notified and can now see reminders you share.</Text>
            <Button title="Done" onPress={() => router.replace('/family')} style={styles.fullWidth} />
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  stepRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  stepItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepConnectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepDotText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepDotTextActive: {
    color: colors.white,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  stepLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
    color: colors.textMuted,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  centerBlock: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  envelopeWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  envelopeHeart: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  stepTitle: {
    ...typography.h2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  hintText: {
    ...typography.caption,
    flex: 1,
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  permissionRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  permissionTextWrap: {
    flex: 1,
  },
  permissionLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  permissionDesc: {
    ...typography.caption,
    marginTop: 2,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  doneIconWrap: {
    marginBottom: spacing.lg,
  },
});
