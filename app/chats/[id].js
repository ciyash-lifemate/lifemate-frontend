import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { ChatBubble } from '../../src/components/ChatBubble.js';
import { MessageInput } from '../../src/components/MessageInput.js';
import { Avatar } from '../../src/components/Avatar.js';
import { listMessages, sendMessage, editMessage, deleteMessage, markChatRead, uploadFile } from '../../src/api/index.js';
import { socket } from '../../src/api/socket.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { parseServerDate } from '../../src/utils/date.js';
import { colors, spacing, typography } from '../../src/theme.js';

const TYPING_FALLBACK_MS = 5000;

const lastSeenLabel = (value) => {
  const d = parseServerDate(value);
  if (!d) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Last seen today at ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `Last seen ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};

export default function ChatConversation() {
  const router = useRouter();
  const { id, name, otherUserId, avatar, online: onlineParam, lastSeen: lastSeenParam } = useLocalSearchParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [isOnline, setIsOnline] = useState(onlineParam === '1');
  const [lastSeenAt, setLastSeenAt] = useState(lastSeenParam || '');
  const listRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await listMessages(id);
      setMessages(Array.isArray(data) ? data : []);
      socket.emit('message:delivered', { chatId: id });
      socket.emit('message:read', { chatId: id });
      markChatRead(id).catch(() => {}); // REST fallback in case the socket is briefly disconnected
    } catch {
      setMessages([]);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Live for the whole time this screen is mounted, not just while focused.
  useEffect(() => {
    const onNewMessage = (msg) => {
      if (String(msg.chat_id) !== String(id)) return;
      setMessages((prev) => {
        const isMine = String(msg.sender_id) === String(user?.id);
        if (isMine) {
          const optimisticIndex = prev.findIndex(
            (m) => String(m.id).startsWith('local-') && m.content === msg.content && m.message_type === msg.message_type
          );
          if (optimisticIndex !== -1) {
            const next = [...prev];
            next[optimisticIndex] = msg;
            return next;
          }
        }
        if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
        return [...prev, msg];
      });
      socket.emit('message:delivered', { chatId: id });
    };

    const onStatus = ({ chatId, messageIds, status }) => {
      if (String(chatId) !== String(id)) return;
      setMessages((prev) =>
        prev.map((m) => (!messageIds || messageIds.includes(m.id) ? { ...m, status } : m))
      );
    };

    const onEdited = (msg) => {
      if (String(msg.chat_id) !== String(id)) return;
      setMessages((prev) => prev.map((m) => (String(m.id) === String(msg.id) ? msg : m)));
    };

    const onDeleted = ({ chatId, messageId }) => {
      if (String(chatId) !== String(id)) return;
      setMessages((prev) =>
        prev.map((m) => (String(m.id) === String(messageId) ? { ...m, is_deleted: true } : m))
      );
    };

    const onTypingStart = (payload) => {
      if (String(payload.chatId) !== String(id)) return;
      setTypingUser(payload.userId);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), TYPING_FALLBACK_MS);
    };

    const onTypingStop = (payload) => {
      if (String(payload.chatId) !== String(id)) return;
      clearTimeout(typingTimeoutRef.current);
      setTypingUser((current) => (String(current) === String(payload.userId) ? null : current));
    };

    const onPresence = (payload) => {
      if (String(payload.userId) !== String(otherUserId)) return;
      setIsOnline(payload.status === 'online');
      if (payload.lastSeen) setLastSeenAt(payload.lastSeen);
    };

    socket.on('message:new', onNewMessage);
    socket.on('message:status', onStatus);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('presence:update', onPresence);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('message:status', onStatus);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('presence:update', onPresence);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [id, user?.id, otherUserId]);

  const markFailed = (tempId) => {
    setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)));
  };

  const scrollToEndSoon = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  // Shared by text and media sends - see MessageInput/attachment flow for the
  // media payload shape (mediaUrl/mediaName/mediaMime/mediaSize/mediaDuration
  // replacing `content`).
  // Shared by text sends and media sends (after upload) - takes an explicit
  // tempId so a media message can reuse the same bubble it was already
  // showing mid-upload instead of swapping in a second one.
  const sendPayload = (tempId, payload, localPreview) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === tempId)) {
        return prev.map((m) => (m.id === tempId ? { ...m, ...localPreview, status: 'sent' } : m));
      }
      return [
        ...prev,
        {
          id: tempId,
          sender_id: user?.id,
          status: 'sent',
          is_edited: false,
          is_deleted: false,
          created_at: new Date().toISOString(),
          ...localPreview,
        },
      ];
    });

    if (socket.connected) {
      socket.timeout(8000).emit('message:send', { chatId: id, tempId, ...payload }, (err, ack) => {
        if (err || !ack?.success) markFailed(tempId);
        else setMessages((prev) => prev.map((m) => (m.id === tempId ? ack.message : m)));
        scrollToEndSoon();
      });
    } else {
      sendMessage(id, payload)
        .then((saved) => setMessages((prev) => prev.map((m) => (m.id === tempId ? saved : m))))
        .catch(() => markFailed(tempId))
        .finally(scrollToEndSoon);
    }
  };

  const submitEdit = (messageId, content) => {
    setEditingMessage(null);
    if (socket.connected) {
      socket.timeout(8000).emit('message:edit', { chatId: id, messageId, content }, (err, ack) => {
        if (!err && ack?.success && ack.message) {
          setMessages((prev) => prev.map((m) => (String(m.id) === String(messageId) ? ack.message : m)));
        }
      });
    } else {
      editMessage(id, messageId, content)
        .then((updated) => setMessages((prev) => prev.map((m) => (String(m.id) === String(messageId) ? updated : m))))
        .catch(() => {});
    }
  };

  const handleSend = (content) => {
    if (editingMessage) {
      submitEdit(editingMessage.id, content);
      return;
    }
    sendPayload(`local-${Date.now()}`, { content, messageType: 'text' }, { content, message_type: 'text' });
  };

  // Called by MessageInput once a photo/video/document is picked or a voice
  // note is recorded. Shows the local file immediately (Image/VideoView/the
  // audio player all play a local file:// uri just fine), uploads it, then
  // hands off to the same send path with the resulting remote mediaUrl.
  const handleAttach = async (asset) => {
    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: user?.id,
        status: 'sent',
        is_edited: false,
        is_deleted: false,
        created_at: new Date().toISOString(),
        message_type: asset.messageType,
        media_url: asset.uri,
        media_name: asset.name,
        media_mime: asset.mime,
        media_size: asset.size,
        media_duration: asset.duration,
      },
    ]);
    scrollToEndSoon();

    try {
      const uploaded = await uploadFile(asset);
      sendPayload(
        tempId,
        {
          messageType: asset.messageType,
          mediaUrl: uploaded.url,
          mediaName: uploaded.name,
          mediaSize: uploaded.size,
          mediaMime: uploaded.mime,
          mediaDuration: asset.duration,
        },
        {
          message_type: asset.messageType,
          media_url: uploaded.url,
          media_name: uploaded.name,
          media_mime: uploaded.mime,
          media_size: uploaded.size,
          media_duration: asset.duration,
        }
      );
    } catch {
      markFailed(tempId);
    }
  };

  const handleDeleteMessage = (message) => {
    setMessages((prev) =>
      prev.map((m) => (String(m.id) === String(message.id) ? { ...m, is_deleted: true } : m))
    );
    const revert = () =>
      setMessages((prev) =>
        prev.map((m) => (String(m.id) === String(message.id) ? { ...m, is_deleted: false } : m))
      );

    if (socket.connected) {
      socket.timeout(8000).emit('message:delete', { chatId: id, messageId: message.id }, (err, ack) => {
        if (err || !ack?.success) revert();
      });
    } else {
      deleteMessage(id, message.id).catch(revert);
    }
  };

  const handleLongPressMessage = (message) => {
    if (String(message.id).startsWith('local-')) return; // not saved yet - nothing to edit/delete
    const options = [{ text: 'Cancel', style: 'cancel' }];
    if (message.message_type === 'text' || !message.message_type) {
      options.push({ text: 'Edit', onPress: () => setEditingMessage(message) });
    }
    options.push({ text: 'Delete', style: 'destructive', onPress: () => handleDeleteMessage(message) });
    Alert.alert('Message options', undefined, options);
  };

  const isOtherTyping = typingUser != null && String(typingUser) === String(otherUserId);
  const subtitle = isOtherTyping ? 'typing…' : isOnline ? 'Online' : lastSeenLabel(lastSeenAt);

  return (
    <ScreenContainer edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Avatar name={name} uri={avatar} online={isOnline} size={38} />
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>{name || 'Chat'}</Text>
            {subtitle ? (
              <Text style={[styles.headerSubtitle, isOtherTyping && styles.headerSubtitleTyping]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.headerIcons}>
          <Ionicons name="call-outline" size={20} color={colors.text} style={styles.headerIcon} />
          <Ionicons name="videocam-outline" size={22} color={colors.text} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              isMine={String(item.sender_id) === String(user?.id)}
              onLongPress={handleLongPressMessage}
            />
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        <MessageInput
          onSend={handleSend}
          onAttach={handleAttach}
          sending={sending}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onTypingStart={() => socket.emit('typing:start', { chatId: id })}
          onTypingStop={() => socket.emit('typing:stop', { chatId: id })}
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTextWrap: {
    marginLeft: spacing.sm,
    flexShrink: 1,
  },
  headerTitle: {
    ...typography.h3,
  },
  headerSubtitle: {
    ...typography.caption,
  },
  headerSubtitleTyping: {
    color: colors.primary,
    fontWeight: '600',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: spacing.md,
  },
  list: {
    padding: spacing.lg,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
});
