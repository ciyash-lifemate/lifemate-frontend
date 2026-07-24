import { useState } from 'react';
import { View, Text, ScrollView, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { Header } from '../src/components/Header.js';
import { TextField } from '../src/components/TextField.js';
import { DateField } from '../src/components/DateField.js';
import { SelectField } from '../src/components/SelectField.js';
import { Button } from '../src/components/Button.js';
import { Avatar } from '../src/components/Avatar.js';
import { updateMe } from '../src/api/index.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, spacing, typography } from '../src/theme.js';
import { LANGUAGES } from '../src/constants/profile.js';

export default function EditProfile() {
  const router = useRouter();
  const { user, setUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || '');
  const [language, setLanguage] = useState(user?.language || 'English');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    setLoading(true);
    try {
      const updated = await updateMe({
        name: name.trim(),
        email: email.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        language,
      });
      setUser(updated);
      router.back();
    } catch (err) {
      Alert.alert('Could not save profile', err.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Edit Profile" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          <Avatar name={name} size={96} />
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={14} color={colors.white} />
          </View>
        </View>

        <TextField label="Full Name" placeholder="Ravi Kumar" value={name} onChangeText={setName} />
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

        <Button title="Save Changes" onPress={handleSave} loading={loading} style={styles.submit} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
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
