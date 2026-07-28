import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { colors } from '../theme.js';

// Only one native recognition session can run at a time, but every
// VoiceMicButton on screen subscribes to the same global start/result/end
// events. This id gate is what keeps a mic tap on one field from also
// pushing transcribed text into every other voice-enabled field mounted
// alongside it.
let activeFieldId = null;

export const VoiceMicButton = ({ value, onChangeText, lang = 'en-IN', style }) => {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = Symbol('voice-mic');
  const [listening, setListening] = useState(false);
  const baseValueRef = useRef('');

  useSpeechRecognitionEvent('result', (event) => {
    if (activeFieldId !== idRef.current) return;
    const transcript = event.results?.[0]?.transcript;
    if (transcript === undefined) return;
    const base = baseValueRef.current;
    onChangeText(base ? `${base}${transcript}` : transcript);
  });
  useSpeechRecognitionEvent('end', () => {
    if (activeFieldId !== idRef.current) return;
    activeFieldId = null;
    setListening(false);
  });
  useSpeechRecognitionEvent('error', (event) => {
    if (activeFieldId !== idRef.current) return;
    activeFieldId = null;
    setListening(false);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      Alert.alert('Voice input failed', event.message || 'Please try again.');
    }
  });

  const handlePress = async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone permission needed', 'Please allow microphone access to use voice input.');
      return;
    }
    const trimmed = (value || '').trim();
    baseValueRef.current = trimmed ? `${trimmed} ` : '';
    activeFieldId = idRef.current;
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang, interimResults: true, continuous: true });
  };

  return (
    <Pressable onPress={handlePress} hitSlop={10} style={[styles.btn, style]}>
      <Ionicons name={listening ? 'mic' : 'mic-outline'} size={20} color={listening ? colors.primary : colors.textSecondary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    padding: 4,
  },
});
