import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { BottomNavBar } from '../../src/components/BottomNavBar.js';
import { Avatar } from '../../src/components/Avatar.js';
import { listChats } from '../../src/api/index.js';
import { socket } from '../../src/api/socket.js';
import { useAuth } from '../../src/context/AuthContext.js';
import { parseServerDate, formatClockTime } from '../../src/utils/date.js';
import { labelForMessageType } from '../../src/utils/chat.js';
import { colors, radius, spacing, typography } from '../../src/theme.js';

const formatTime = (value) => {
  const d = parseServerDate(value);
  if (!d) return '';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return formatClockTime(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short' });
};

const ChatRow = ({ chat, onPress }) => {
  const name = chat.other_user_name || 'Unknown';
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar name={name} uri={chat.other_user_avatar} online={chat.other_user_online} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
        <Text style={styles.rowMessage} numberOfLines={1}>
          {chat.last_message || labelForMessageType(chat.last_message_type)}
        </Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.rowTime}>{formatTime(chat.last_message_at)}</Text>
        {chat.unread_count > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{chat.unread_count}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

export default function ChatList() {
  const router = useRouter();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await listChats();
      setChats(Array.isArray(data) ? data : []);
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Kept live for as long as this screen is mounted (not just while focused),
  // so a message arriving while the user is inside a conversation still
  // updates the list underneath it.
  useEffect(() => {
    const onNewMessage = (message) => {
      setChats((prev) => {
        const index = prev.findIndex((c) => String(c.chat_id) === String(message.chat_id));
        if (index === -1) {
          load(); // a chat we don't know about yet (e.g. just created) - refetch
          return prev;
        }
        const isMine = String(message.sender_id) === String(user?.id);
        const next = [...prev];
        next[index] = {
          ...next[index],
          last_message: message.is_deleted ? null : message.content,
          last_message_type: message.message_type,
          last_message_at: message.created_at,
          unread_count: isMine ? next[index].unread_count : next[index].unread_count + 1,
        };
        return next.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
      });
    };

    const onPresence = ({ userId, status, lastSeen }) => {
      setChats((prev) =>
        prev.map((c) =>
          String(c.other_user_id) === String(userId)
            ? { ...c, other_user_online: status === 'online', other_user_last_seen: lastSeen ?? c.other_user_last_seen }
            : c
        )
      );
    };

    socket.on('message:new', onNewMessage);
    socket.on('presence:update', onPresence);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('presence:update', onPresence);
    };
  }, [user?.id, load]);

  const filtered = chats.filter((c) => (c.other_user_name || '').toLowerCase().includes(search.toLowerCase()));
  const pinned = filtered.filter((c) => c.is_pinned);
  const rest = filtered.filter((c) => !c.is_pinned);

  const openChat = (chat) => {
    router.push({
      pathname: `/chats/${chat.chat_id}`,
      params: {
        name: chat.other_user_name || 'Unknown',
        otherUserId: chat.other_user_id,
        avatar: chat.other_user_avatar || '',
        online: chat.other_user_online ? '1' : '',
        lastSeen: chat.other_user_last_seen || '',
      },
    });
  };

  return (
    <ScreenContainer edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <Pressable onPress={() => router.push('/chats/new')} hitSlop={10}>
          <Ionicons name="person-add-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={[
          ...(pinned.length ? [{ type: 'header', key: 'pinned', label: 'Pinned' }] : []),
          ...pinned.map((c) => ({ type: 'chat', key: `p-${c.chat_id}`, chat: c })),
          ...(rest.length ? [{ type: 'header', key: 'all', label: 'All Chats' }] : []),
          ...rest.map((c) => ({ type: 'chat', key: `a-${c.chat_id}`, chat: c })),
        ]}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <Text style={styles.sectionLabel}>{item.label}</Text>
          ) : (
            <ChatRow chat={item.chat} onPress={() => openChat(item.chat)} />
          )
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.emptyText}>No chats yet.</Text> : null
        }
      />

      <BottomNavBar />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.bodyMuted,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowName: {
    ...typography.body,
    fontWeight: '600',
  },
  rowMessage: {
    ...typography.bodyMuted,
    marginTop: 2,
  },
  rowMeta: {
    alignItems: 'flex-end',
  },
  rowTime: {
    ...typography.caption,
    marginBottom: 6,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
