import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Button } from '../../src/components/Button.js';
import { VoiceMicButton } from '../../src/components/VoiceMicButton.js';
import { getNote, createNote, updateNote, deleteNote, getErrorMessage } from '../../src/api/index.js';
import { colors, spacing, typography } from '../../src/theme.js';

export default function NoteEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!isNew);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const note = await getNote(id);
        setTitle(note.title || '');
        setContent(note.content || '');
      } catch {
        Alert.alert('Could not load note', 'Please try again.');
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, [id]);

  // Stop any in-progress speech if the screen is left mid-read.
  useEffect(() => () => Speech.stop(), []);

  const handleSpeakTitle = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    if (!title.trim()) return;
    setIsSpeaking(true);
    Speech.speak(title.trim(), {
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) {
      Alert.alert('Empty note', 'Please enter a title or write something first.');
      return;
    }
    // The backend requires a non-empty title - if the user only wrote
    // content, borrow its opening words instead of forcing them to also
    // type a separate title (same "title optional as long as something is
    // there" idea as Keep-style note apps).
    const savedTitle = title.trim() || content.trim().slice(0, 60);
    setLoading(true);
    try {
      if (isNew) {
        await createNote({ title: savedTitle, content: content.trim() });
      } else {
        await updateNote(id, { title: savedTitle, content: content.trim() });
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not save note', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete note', 'This note will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete note', getErrorMessage(err));
          }
        },
      },
    ]);
  };

  if (loadingExisting) {
    return (
      <ScreenContainer>
        <Text style={styles.loadingText}>Loading…</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isNew ? 'New Note' : 'Edit Note'}</Text>
        {!isNew ? (
          <Pressable onPress={handleDelete} hitSlop={12}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <TextInput
            style={[styles.titleInput, styles.titleInputFlex]}
            placeholder="Note title"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
          {title.trim() ? (
            <Pressable onPress={handleSpeakTitle} hitSlop={12} style={styles.speakBtn}>
              <Ionicons
                name={isSpeaking ? 'volume-high' : 'volume-medium-outline'}
                size={22}
                color={isSpeaking ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          ) : null}
          <VoiceMicButton value={title} onChangeText={setTitle} style={styles.speakBtn} />
        </View>
        <View style={styles.contentWrap}>
          <TextInput
            style={styles.contentInput}
            placeholder="Start writing..."
            placeholderTextColor={colors.textMuted}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />
          <VoiceMicButton value={content} onChangeText={setContent} style={styles.contentMicBtn} />
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="Save Note" onPress={handleSave} loading={loading} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.h3,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleInput: {
    ...typography.h2,
    paddingVertical: spacing.sm,
  },
  titleInputFlex: {
    flex: 1,
  },
  speakBtn: {
    marginLeft: spacing.sm,
  },
  contentWrap: {
    flex: 1,
  },
  contentInput: {
    ...typography.body,
    flex: 1,
    lineHeight: 22,
    paddingRight: spacing.xl,
  },
  contentMicBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  loadingText: {
    ...typography.bodyMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
