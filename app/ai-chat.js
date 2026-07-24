import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScreenContainer } from '../src/components/ScreenContainer.js';
import { ChatBubble } from '../src/components/ChatBubble.js';
import { MessageInput } from '../src/components/MessageInput.js';
import { listAiMessages, sendAiMessage } from '../src/api/index.js';
import { useAuth } from '../src/context/AuthContext.js';
import { colors, radius, spacing, typography } from '../src/theme.js';

const welcomeMessage = (firstName) => ({
  id: 'welcome',
  content: `Hello ${firstName}! 👋\nHow can I help you today?`,
  role: 'assistant',
  created_at: new Date().toISOString(),
});

export default function AiChat() {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState(() => [welcomeMessage(user?.name?.split(' ')[0] || 'there')]);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await listAiMessages();
      const items = Array.isArray(data) ? data : [];
      if (items.length) setMessages(items);
    } catch {
      // Keep the local welcome message if the backend has nothing yet.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async (content) => {
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, content, role: 'user', created_at: new Date().toISOString() },
    ]);
    setSending(true);
    try {
      // sendAiMessage replies with { userMessage, assistantMessage } - swap
      // the optimistic bubble for the persisted user row and append the reply.
      const { userMessage, assistantMessage } = await sendAiMessage(content);
      setMessages((prev) => [
        ...prev.map((m) => (m.id === optimisticId ? userMessage || m : m)),
        assistantMessage,
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          content: "Sorry, I couldn't process that right now.",
          role: 'assistant',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="robot-happy-outline" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>LifeMate AI</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </View>
        <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
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
          renderItem={({ item }) => <ChatBubble message={item} isMine={item.role === 'user'} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
        <MessageInput onSend={handleSend} sending={sending} />
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
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
  },
  headerStatus: {
    ...typography.caption,
    color: colors.success,
  },
  list: {
    padding: spacing.lg,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
});
