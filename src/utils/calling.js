import Constants, { ExecutionEnvironment } from 'expo-constants';

// react-native-webrtc ships real native code with no Expo Go build at all
// (unlike expo-audio/expo-notifications, there's no partial support) - it
// only exists in a custom dev-client/production build. Statically importing
// it would throw immediately on load in Expo Go, so it's required lazily and
// only once this check has passed.
const isSupported = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export const isCallingSupported = () => isSupported;

let cachedModule = null;
export const getWebRTC = () => {
  if (!isSupported) return null;
  if (!cachedModule) {
    cachedModule = require('react-native-webrtc');
  }
  return cachedModule;
};
