import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenContainer } from '../../src/components/ScreenContainer.js';
import { Button } from '../../src/components/Button.js';
import { getNote, createNote, updateNote, deleteNote } from '../../src/api/index.js';
import { colors, spacing, typography } from '../../src/theme.js';

export default function NoteEditor() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(!isNew);

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

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a note title.');
      return;
    }
    setLoading(true);
    try {
      if (isNew) {
        await createNote({ title: title.trim(), content: content.trim() });
      } else {
        await updateNote(id, { title: title.trim(), content: content.trim() });
      }
      router.back();
    } catch (err) {
      Alert.alert('Could not save note', err.response?.data?.message || 'Please try again.');
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
            Alert.alert('Could not delete note', err.response?.data?.message || 'Please try again.');
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
        <TextInput
          style={styles.titleInput}
          placeholder="Note title"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.contentInput}
          placeholder="Start writing..."
          placeholderTextColor={colors.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          textAlignVertical="top"
        />
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
  titleInput: {
    ...typography.h2,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  contentInput: {
    ...typography.body,
    flex: 1,
    lineHeight: 22,
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
