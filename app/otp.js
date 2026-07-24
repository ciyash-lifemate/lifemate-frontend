import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { Header } from '../src/components/Header.js';
import { Button } from '../src/components/Button.js';
import { verifyOtp, sendOtp } from '../src/api/index.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, spacing, typography, radius } from '../src/theme.js';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function Otp() {
  const router = useRouter();
  const { mobile, debugOtp } = useLocalSearchParams();
  const { signIn } = useAuth();

  const [digits, setDigits] = useState(() =>
    debugOtp ? debugOtp.padEnd(OTP_LENGTH, ' ').split('').map((c) => c.trim()) : Array(OTP_LENGTH).fill('')
  );
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputs = useRef([]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const handleChange = (value, index) => {
    const clean = value.replace(/[^0-9]/g, '');

    // SMS/iOS autofill delivers the whole code as one string into whichever
    // box currently has focus, rather than one digit per box.
    if (clean.length > 1) {
      const next = Array(OTP_LENGTH).fill('');
      clean.slice(0, OTP_LENGTH).split('').forEach((d, i) => {
        next[i] = d;
      });
      setDigits(next);
      const lastIndex = Math.min(clean.length, OTP_LENGTH) - 1;
      inputs.current[lastIndex]?.blur();
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (clean && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (!clean && index > 0) inputs.current[index - 1]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length !== OTP_LENGTH) {
      Alert.alert('Enter the full code', `Please enter all ${OTP_LENGTH} digits.`);
      return;
    }

    console.log('[verifyOtp] verifying', { mobile, code });
    setLoading(true);
    try {
      const { token, user } = await verifyOtp(mobile, code);
      console.log('[verifyOtp] success', { user });
      await signIn(token, user);
      console.log('[login] signed in, redirecting to', user.is_profile_complete ? '/home' : '/create-profile');
      router.replace(user.is_profile_complete ? '/home' : '/create-profile');
    } catch (err) {
      console.error('[verifyOtp] failed', err.message, err.response?.data, err.toJSON?.());
      Alert.alert('Verification failed', err.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    console.log('[sendOtp] resending OTP for', mobile);
    try {
      const { debugOtp: newDebugOtp } = await sendOtp(mobile);
      console.log('[sendOtp] resend success', { mobile, debugOtp: newDebugOtp });
      if (newDebugOtp) Alert.alert('Debug OTP', `Your OTP is ${newDebugOtp}`);
      setSecondsLeft(RESEND_SECONDS);
      setDigits(
        newDebugOtp
          ? newDebugOtp.padEnd(OTP_LENGTH, ' ').split('').map((c) => c.trim())
          : Array(OTP_LENGTH).fill('')
      );
    } catch (err) {
      console.error('[sendOtp] resend failed', err.message, err.response?.data, err.toJSON?.());
      Alert.alert('Could not resend OTP', err.response?.data?.message || 'Please try again.');
    }
  };

  return (
    <ScreenContainer>
      <Header title="" />
      <View style={styles.content}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>Enter the 6 digit code sent to</Text>
        <Text style={styles.mobile}>{mobile}</Text>

        <View style={styles.otpRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => (inputs.current[i] = ref)}
              style={styles.otpBox}
              value={digit}
              onChangeText={(value) => handleChange(value, i)}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
          ))}
        </View>

        <Pressable onPress={handleResend} disabled={secondsLeft > 0}>
          <Text style={styles.resend}>
            {secondsLeft > 0 ? `Resend OTP in 00:${String(secondsLeft).padStart(2, '0')}` : 'Resend OTP'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Button title="Verify & Continue" onPress={handleVerify} loading={loading} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyMuted,
  },
  mobile: {
    ...typography.h3,
    marginBottom: spacing.xl,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  resend: {
    ...typography.bodyMuted,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    marginTop: 'auto',
  },
});
