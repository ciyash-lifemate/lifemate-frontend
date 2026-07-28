import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { parseServerDate, formatClockTime } from '../utils/date.js';
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

export const ChatBubble = ({ message, isMine, onLongPress }) => {
  const isDeleted = !!message.is_deleted;
  // Ticks are a real-chat concept (server always sets `status`) - the AI
  // assistant chat reuses this component but its messages have no `status`,
  // so this keeps them tick-free without a separate prop.
  const showStatus = isMine && message.status !== undefined;

  return (
    <Pressable
      onLongPress={!isDeleted ? () => onLongPress?.(message) : undefined}
      delayLongPress={300}
      style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}
    >
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {isDeleted ? (
          <Text style={[styles.deletedText, isMine && styles.textMine]}>This message was deleted</Text>
        ) : (
          <Text style={[styles.text, isMine && styles.textMine]}>{message.content}</Text>
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
  deletedText: {
    ...typography.body,
    fontStyle: 'italic',
    color: colors.textMuted,
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
