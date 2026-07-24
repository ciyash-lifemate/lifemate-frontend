import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { colors, radius, spacing, typography } from '../theme.js';

const TYPING_IDLE_MS = 2000;

// Normalizes an expo-image-picker asset into the shape the parent screen's
// upload/send pipeline expects (see uploadFile/sendPayload in chats/[id].js).
const fromImagePickerAsset = (asset) => ({
  uri: asset.uri,
  name: asset.fileName || `${asset.type || 'file'}-${Date.now()}`,
  mime: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
  size: asset.fileSize,
  messageType: asset.type === 'video' ? 'video' : 'image',
  duration: asset.duration ? Math.round(asset.duration / 1000) : undefined, // ms -> seconds
});

const fromDocumentPickerAsset = (asset) => ({
  uri: asset.uri,
  name: asset.name,
  mime: asset.mimeType || 'application/octet-stream',
  size: asset.size,
  messageType: 'document',
});

export const MessageInput = ({ onSend, onAttach, sending, editingMessage, onCancelEdit, onTypingStart, onTypingStop }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (editingMessage) setText(editingMessage.content || '');
  }, [editingMessage]);

  const stopTyping = () => {
    clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop?.();
    }
  };

  const handleChangeText = (value) => {
    setText(value);
    if (!onTypingStart) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart();
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setText('');
    stopTyping();
    onSend(trimmed);
  };

  const pickFromLibrary = async (useCamera) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const options = { mediaTypes: ['images', 'videos'], quality: 0.8 };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.length) return;
    onAttach?.(fromImagePickerAsset(result.assets[0]));
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (result.canceled || !result.assets?.length) return;
    onAttach?.(fromDocumentPickerAsset(result.assets[0]));
  };

  const openAttachMenu = () => {
    Alert.alert('Send', undefined, [
      { text: 'Photo Library', onPress: () => pickFromLibrary(false) },
      { text: 'Camera', onPress: () => pickFromLibrary(true) },
      { text: 'Document', onPress: pickDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const startRecording = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    await recorder.stop();
    if (recorder.uri) {
      onAttach?.({ uri: recorder.uri, name: `voice-${Date.now()}.m4a`, mime: 'audio/m4a', messageType: 'voice' });
    }
  };

  return (
    <View>
      {editingMessage ? (
        <View style={styles.editingBanner}>
          <Text style={styles.editingText} numberOfLines={1}>Editing message</Text>
          <Pressable onPress={() => onCancelEdit?.()} hitSlop={10}>
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.row}>
        {onAttach ? (
          <Pressable style={styles.attachBtn} onPress={openAttachMenu} hitSlop={10} disabled={isRecording}>
            <Ionicons name="add-circle-outline" size={26} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder={isRecording ? 'Recording…' : 'Type a message...'}
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={handleChangeText}
            editable={!isRecording}
            multiline
          />
          <Pressable
            onPressIn={onAttach ? startRecording : undefined}
            onPressOut={onAttach ? stopRecording : undefined}
            hitSlop={10}
          >
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={20}
              color={isRecording ? colors.danger : colors.textSecondary}
            />
          </Pressable>
        </View>
        <Pressable style={styles.sendBtn} onPress={handleSend} disabled={sending}>
          <Ionicons name={editingMessage ? 'checkmark' : 'send'} size={18} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
  },
  editingText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  attachBtn: {
    marginRight: spacing.xs,
    marginBottom: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    minHeight: 44,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    maxHeight: 100,
    marginRight: spacing.xs,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
