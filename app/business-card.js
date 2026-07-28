import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { Header } from '../src/components/Header.js';
import { TextField } from '../src/components/TextField.js';
import { Button } from '../src/components/Button.js';
import { BusinessCardPreview } from '../src/components/BusinessCardPreview.js';
import { CARD_TEMPLATES } from '../src/constants/cardTemplates.js';
import { getBusinessCard, updateBusinessCard, getErrorMessage } from '../src/api/index.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

export default function BusinessCard() {
  const { user } = useAuth();
  const viewShotRef = useRef(null);

  const [cardName, setCardName] = useState('');
  const [designation, setDesignation] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [templateId, setTemplateId] = useState(CARD_TEMPLATES[0].id);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const card = await getBusinessCard();
        setCardName(card.card_name || user?.name || '');
        setDesignation(card.card_designation || '');
        setCompany(card.card_company || '');
        setPhone(card.card_phone || '');
        setEmail(card.card_email || user?.email || '');
        setWebsite(card.card_website || '');
        setAddress(card.card_address || '');
        setTemplateId(card.card_template || CARD_TEMPLATES[0].id);
      } catch {
        // Fall back to a blank form if the card can't be fetched.
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!cardName.trim()) {
      Alert.alert('Name required', 'Please enter the name to show on your card.');
      return;
    }
    setLoading(true);
    try {
      await updateBusinessCard({
        cardName: cardName.trim(),
        cardDesignation: designation.trim(),
        cardCompany: company.trim(),
        cardPhone: phone.trim(),
        cardEmail: email.trim(),
        cardWebsite: website.trim(),
        cardAddress: address.trim(),
        cardTemplate: templateId,
      });
      Alert.alert('Saved', 'Your business card has been saved.');
    } catch (err) {
      Alert.alert('Could not save card', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Captures the live preview below as a PNG, then hands it to the phone's
  // own Share sheet - there's no way to pre-attach an image AND pre-select a
  // WhatsApp contact at the same time, so picking WhatsApp and the contact
  // happens in the share sheet / inside WhatsApp itself, not here.
  const handleShareImage = async () => {
    if (!cardName.trim()) {
      Alert.alert('Name required', 'Please enter the name to show on your card first.');
      return;
    }
    setSharing(true);
    try {
      const uri = await viewShotRef.current.capture();
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing not available', 'This device cannot open the share sheet.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share business card' });
    } catch (err) {
      Alert.alert('Could not share card', err?.message || 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  if (loadingExisting) {
    return (
      <ScreenContainer>
        <Header title="Business Card" />
        <Text style={styles.notFound}>Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header title="Business Card" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.previewWrap}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            <BusinessCardPreview
              templateId={templateId}
              name={cardName}
              designation={designation}
              company={company}
              phone={phone}
              email={email}
              website={website}
              address={address}
            />
          </ViewShot>
        </View>

        <Text style={styles.sectionLabel}>Choose a design</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateRow}>
          {CARD_TEMPLATES.map((t) => (
            <Pressable key={t.id} onPress={() => setTemplateId(t.id)} style={styles.templateItem}>
              <LinearGradient
                colors={t.gradient}
                style={[styles.templateSwatch, templateId === t.id && styles.templateSwatchActive]}
              />
              <Text
                style={[styles.templateLabel, templateId === t.id && styles.templateLabelActive]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <TextField label="Name" placeholder="Ravi Kumar" value={cardName} onChangeText={setCardName} />
        <TextField
          label="Designation"
          placeholder="Founder"
          value={designation}
          onChangeText={setDesignation}
        />
        <TextField label="Company" placeholder="Acme Pvt Ltd" value={company} onChangeText={setCompany} />
        <TextField
          label="Phone"
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextField
          label="Email"
          placeholder="ravi@acme.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextField
          label="Website"
          placeholder="www.acme.com"
          keyboardType="url"
          autoCapitalize="none"
          value={website}
          onChangeText={setWebsite}
        />
        <TextField
          label="Address"
          placeholder="123 Main St, City"
          value={address}
          onChangeText={setAddress}
          multiline
        />

        <Button title="Save Card" onPress={handleSave} loading={loading} style={styles.saveBtn} />

        <Pressable style={styles.whatsappBtn} onPress={handleShareImage} disabled={sharing}>
          <Ionicons name="share-social" size={18} color={colors.success} />
          <Text style={styles.whatsappBtnText}>{sharing ? 'Preparing image…' : 'Share card as image'}</Text>
        </Pressable>
        <Text style={styles.hint}>
          This shares the card above as an image via your phone's share sheet - pick WhatsApp, then pick the person,
          same as sharing any photo.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  previewWrap: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.bodyMuted,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  templateRow: {
    marginBottom: spacing.lg,
  },
  templateItem: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 64,
  },
  templateSwatch: {
    width: 56,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateSwatchActive: {
    borderColor: colors.primary,
  },
  templateLabel: {
    ...typography.caption,
    marginTop: 4,
    textAlign: 'center',
  },
  templateLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  saveBtn: {
    marginTop: spacing.md,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  whatsappBtnText: {
    ...typography.body,
    color: colors.success,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
  },
  notFound: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
