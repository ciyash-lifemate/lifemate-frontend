import { useState } from 'react';
import { View, Text, Image, Pressable, Modal, Linking, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { parseServerDate, formatClockTime } from '../utils/date.js';
import { formatDuration, formatFileSize } from '../utils/chat.js';
import { colors, radius, spacing, typography } from '../theme.js';

const formatTime = (value) => {
  const d = parseServerDate(value);
  return d ? formatClockTime(d) : '';
};

// sent -> single check, delivered -> double check (gray), read -> double check (blue),
// still-sending (local optimistic id) -> clock, failed -> alert icon.
const TickIcon = ({ message }) => {
  if (String(message.id).startsWith('local-')) {
    if (message.status === 'failed') {
      return <Ionicons name="alert-circle" size={14} color={colors.danger} />;
    }
    return <Ionicons name="time-outline" size={13} color={colors.textMuted} />;
  }
  if (message.status === 'read') return <Ionicons name="checkmark-done" size={15} color={colors.blue} />;
  if (message.status === 'delivered') return <Ionicons name="checkmark-done" size={15} color={colors.textMuted} />;
  return <Ionicons name="checkmark" size={15} color={colors.textMuted} />;
};

const ImageBubble = ({ uri }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Image source={{ uri }} style={styles.mediaImage} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.fullScreenBackdrop} onPress={() => setOpen(false)}>
          <Image source={{ uri }} style={styles.fullScreenImage} resizeMode="contain" />
        </Pressable>
      </Modal>
    </>
  );
};

const VideoBubble = ({ uri }) => {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={styles.mediaVideo} nativeControls allowsFullscreen />;
};

const AudioBubble = ({ uri, duration, isMine }) => {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const seconds = status.duration || duration || 0;
  const remaining = Math.max(seconds - (status.currentTime || 0), 0);

  return (
    <Pressable onPress={() => (status.playing ? player.pause() : player.play())} style={styles.audioRow}>
      <Ionicons
        name={status.playing ? 'pause-circle' : 'play-circle'}
        size={32}
        color={isMine ? colors.white : colors.primary}
      />
      <Text style={[styles.audioDuration, isMine && styles.textMine]}>
        {formatDuration(status.playing ? remaining : seconds)}
      </Text>
    </Pressable>
  );
};

const documentIconFor = (mime = '') => {
  if (mime.includes('pdf')) return 'document-text';
  if (mime.includes('word')) return 'document-text-outline';
  if (mime.includes('sheet') || mime.includes('excel')) return 'grid-outline';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'easel-outline';
  return 'document-outline';
};

const DocumentBubble = ({ message, isMine }) => (
  <Pressable style={styles.documentRow} onPress={() => Linking.openURL(message.media_url)}>
    <Ionicons name={documentIconFor(message.media_mime)} size={28} color={isMine ? colors.white : colors.primary} />
    <View style={styles.documentInfo}>
      <Text numberOfLines={1} style={[styles.text, isMine && styles.textMine]}>
        {message.media_name || 'Document'}
      </Text>
      {message.media_size ? (
        <Text style={[styles.documentSize, isMine && styles.textMineMuted]}>{formatFileSize(message.media_size)}</Text>
      ) : null}
    </View>
  </Pressable>
);

const BubbleContent = ({ message, isMine }) => {
  switch (message.message_type) {
    case 'image':
      return <ImageBubble uri={message.media_url} />;
    case 'video':
      return <VideoBubble uri={message.media_url} />;
    case 'audio':
    case 'voice':
      return <AudioBubble uri={message.media_url} duration={message.media_duration} isMine={isMine} />;
    case 'document':
      return <DocumentBubble message={message} isMine={isMine} />;
    case 'location':
      return <Text style={[styles.text, isMine && styles.textMine]}>{message.content || '📍 Shared a location'}</Text>;
    default:
      return <Text style={[styles.text, isMine && styles.textMine]}>{message.content}</Text>;
  }
};

export const ChatBubble = ({ message, isMine, onLongPress }) => {
  const isDeleted = !!message.is_deleted;
  // Ticks are a real-chat concept (server always sets `status`) - the AI
  // assistant chat reuses this component but its messages have no `status`,
  // so this keeps them tick-free without a separate prop.
  const showStatus = isMine && message.status !== undefined;

  return (
    <Pressable
      onLongPress={isMine && !isDeleted ? () => onLongPress?.(message) : undefined}
      delayLongPress={300}
      style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}
    >
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {isDeleted ? (
          <Text style={[styles.deletedText, isMine && styles.textMine]}>This message was deleted</Text>
        ) : (
          <BubbleContent message={message} isMine={isMine} />
        )}
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.time, isMine ? styles.timeMine : styles.timeTheirs]}>
          {formatTime(message.created_at)}
          {message.is_edited && !isDeleted ? ' · edited' : ''}
        </Text>
        {showStatus ? <TickIcon message={message} /> : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    marginBottom: spacing.md,
    maxWidth: '80%',
  },
  rowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  rowTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: radius.sm,
  },
  text: {
    ...typography.body,
  },
  textMine: {
    color: colors.white,
  },
  textMineMuted: {
    color: colors.white,
    opacity: 0.75,
  },
  deletedText: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.textMuted,
  },
  mediaImage: {
    width: 220,
    height: 220,
    borderRadius: radius.md,
  },
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  mediaVideo: {
    width: 240,
    height: 180,
    borderRadius: radius.md,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 160,
  },
  audioDuration: {
    ...typography.body,
    marginLeft: spacing.sm,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 160,
  },
  documentInfo: {
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  documentSize: {
    ...typography.caption,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginHorizontal: 4,
    gap: 4,
  },
  time: {
    ...typography.caption,
  },
  timeMine: {
    color: colors.textMuted,
  },
  timeTheirs: {
    color: colors.textMuted,
  },
});
