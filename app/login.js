import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { TextField } from '../src/components/TextField.js';
import { Button } from '../src/components/Button.js';
import { sendOtp } from '../src/api/index.js';
import { colors, spacing, typography } from '../src/theme.js';

export default function Login() {
  const router = useRouter();
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const digits = mobile.trim();
    if (digits.length < 8) {
      Alert.alert('Invalid number', 'Enter a valid mobile number to continue.');
      return;
    }

    const fullMobile = `+91${digits}`;
    console.log('[sendOtp] requesting OTP for', fullMobile);
    setLoading(true);
    try {
      const { debugOtp } = await sendOtp(fullMobile);
      console.log('[sendOtp] success', { mobile: fullMobile, debugOtp });
      if (debugOtp) Alert.alert('Debug OTP', `Your OTP is ${debugOtp}`);
      router.push({
        pathname: '/otp',
        params: debugOtp ? { mobile: fullMobile, debugOtp } : { mobile: fullMobile },
      });
    } catch (err) {
      console.error('[sendOtp] failed', err.message, err.response?.data, err.toJSON?.());
      Alert.alert('Could not send OTP', err.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    // TODO: wire up expo-auth-session once GOOGLE_CLIENT_ID is configured in
    // the backend .env - this button intentionally has no live provider yet.
    Alert.alert('Google Sign-In', 'Google Sign-In is not configured yet.');
  };

  return (
    <ScreenContainer style={styles.container}>
      <Text style={styles.title}>Welcome Back! 👋</Text>
      <Text style={styles.subtitle}>Enter your mobile number{'\n'}to continue</Text>

      <TextField
        prefix="+91"
        placeholder="Mobile Number"
        keyboardType="phone-pad"
        value={mobile}
        onChangeText={setMobile}
        maxLength={10}
      />

      <Button title="Continue" onPress={handleContinue} loading={loading} style={styles.spaced} />

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>

      <Button title="Continue with Google" variant="outline" onPress={handleGoogle} />

      <Text style={styles.terms}>
        By continuing, you agree to our{'\n'}Terms & Privacy Policy
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyMuted,
    marginBottom: spacing.xl,
  },
  spaced: {
    marginTop: spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.bodyMuted,
    marginHorizontal: spacing.md,
  },
  terms: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
