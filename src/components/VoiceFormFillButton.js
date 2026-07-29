import { useRef, useState } from 'react';
import { Pressable, Text, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from '../utils/speechRecognition.js';
import { colors, radius, spacing, typography } from '../theme.js';

// Own start/stop gate, separate from VoiceMicButton's - this button hands a
// whole spoken sentence to a parser that fills several fields at once,
// rather than one field's raw text, so it can't share that per-field gate.
let activeSessionId = null;

export const VoiceFormFillButton = ({ onResult, lang = 'en-IN', label = 'Fill with voice', style }) => {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = Symbol('voice-form-fill');
  const [listening, setListening] = useState(false);
  const transcriptRef = useRef('');

  useSpeechRecognitionEvent('result', (event) => {
    if (activeSessionId !== idRef.current) return;
    const transcript = event.results?.[0]?.transcript;
    if (transcript === undefined) return;
    transcriptRef.current = transcript;
  });
  useSpeechRecognitionEvent('end', () => {
    if (activeSessionId !== idRef.current) return;
    activeSessionId = null;
    setListening(false);
    const finalTranscript = transcriptRef.current.trim();
    if (finalTranscript) onResult(finalTranscript);
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (activeSessionId !== idRef.current) return;
    activeSessionId = null;
    setListening(false);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      Alert.alert('Voice input failed', event.message || 'Please try again.');
    }
  });

  const handlePress = async () => {
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert('Voice input unavailable', 'This build of the app does not include voice input yet.');
      return;
    }
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone permission needed', 'Please allow microphone access to use voice input.');
      return;
    }
    transcriptRef.current = '';
    activeSessionId = idRef.current;
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: true });
  };

  return (
    <Pressable style={[styles.btn, listening && styles.btnActive, style]} onPress={handlePress}>
      <Ionicons
        name={listening ? 'mic' : 'mic-outline'}
        size={18}
        color={listening ? colors.primary : colors.textSecondary}
      />
      <Text style={[styles.label, listening && styles.labelActive]}>
        {listening ? 'Listening… tap to stop' : label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  btnActive: {
    borderColor: colors.primary,
  },
  label: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.primary,
  },
});
