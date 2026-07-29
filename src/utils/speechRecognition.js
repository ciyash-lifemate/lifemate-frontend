// expo-speech-recognition's native module throws the instant it's imported
// if the running binary doesn't have it linked (Expo Go, or a dev client
// built before this package was added to the project) - same class of
// problem as expo-notifications in Expo Go (see src/utils/notifications.js).
// A static `import` can't be guarded after the fact since it throws before
// any of our own code runs, so this is a lazy `require` inside a try/catch
// instead, done once here and shared by every voice-input component.
let speechRecognition;
try {
  speechRecognition = require('expo-speech-recognition');
} catch {
  speechRecognition = null;
}

export const ExpoSpeechRecognitionModule = speechRecognition?.ExpoSpeechRecognitionModule ?? null;

export const useSpeechRecognitionEvent = speechRecognition?.useSpeechRecognitionEvent ?? (() => {});

export const isSpeechRecognitionSupported = () => !!ExpoSpeechRecognitionModule;
