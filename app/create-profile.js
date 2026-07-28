import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { Header } from '../src/components/Header.js';
import { TextField } from '../src/components/TextField.js';
import { DateField } from '../src/components/DateField.js';
import { SelectField } from '../src/components/SelectField.js';
import { Button } from '../src/components/Button.js';
import { updateMe, getErrorMessage } from '../src/api/index.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, spacing, typography, radius } from '../src/theme.js';
import { LANGUAGES } from '../src/constants/profile.js';

export default function CreateProfile() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [language, setLanguage] = useState('English');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    setLoading(true);
    try {
      const user = await updateMe({
        name: name.trim(),
        email: email.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        language,
      });
      setUser(user);
      router.replace('/home');
    } catch (err) {
      Alert.alert('Could not save profile', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Your Profile</Text>
        <Text style={styles.subtitle}>Tell us a bit about you</Text>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={colors.textMuted} />
          </View>
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={14} color={colors.white} />
          </View>
        </View>

        <TextField label="Full Name" placeholder="Ravi Kumar" value={name} onChangeText={setName} voiceInput />
        <TextField
          label="Email (optional)"
          placeholder="ravi@gmail.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <DateField label="Date of Birth" value={dateOfBirth} onChange={setDateOfBirth} mode="date" />
        <SelectField label="Language" value={language} options={LANGUAGES} onChange={setLanguage} />

        <Button title="Continue" onPress={handleContinue} loading={loading} style={styles.submit} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMuted,
    marginBottom: spacing.lg,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  submit: {
    marginTop: spacing.md,
  },
});
