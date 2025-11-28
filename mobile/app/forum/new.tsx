import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tum-mock-token';
const categories = [
  { key: 'market', label: 'Market' },
  { key: 'qa', label: 'Q&A' },
  { key: 'discussion', label: 'Discussion' },
] as const;

export default function ForumNewScreen() {
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const text = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'tint');

  const [tokenChecked, setTokenChecked] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<typeof categories[number]['key']>('discussion');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      setToken(saved);
      setTokenChecked(true);
      if (!saved) router.replace('/profile');
    })();
  }, []);

  const onSubmit = async () => {
    if (!token) return;
    if (title.trim().length < 3 || body.trim().length < 3) {
      setError('Title and body must be at least 3 characters.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/forum/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, body, category }),
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || `HTTP ${response.status}`);
      }
      router.replace('/forum');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tokenChecked) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <ThemedText style={{ fontSize: 18 }}>‹ Back</ThemedText>
            </TouchableOpacity>
            <ThemedText type="title">New post</ThemedText>
            <View style={{ width: 60 }} />
          </View>

          <ThemedText style={{ color: muted }}>Share a post with the community.</ThemedText>
          <View style={styles.chips}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.chip,
                  { borderColor: border, backgroundColor: category === c.key ? accent : 'transparent' },
                ]}
                onPress={() => setCategory(c.key)}
              >
                <ThemedText style={{ color: category === c.key ? '#f8fafc' : muted }}>{c.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, { borderColor: border, color: text }]}
            placeholder="Title"
            placeholderTextColor={muted}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.textarea, { borderColor: border, color: text }]}
            placeholder="Body"
            placeholderTextColor={muted}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: accent }]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#f8fafc" /> : <ThemedText style={styles.buttonText}>Post</ThemedText>}
          </TouchableOpacity>
          {error ? <ThemedText style={{ color: '#b91c1c' }}>Error: {error}</ThemedText> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  input: {
    borderWidth: 1.2,
    borderRadius: 10,
    padding: 12,
  },
  textarea: {
    borderWidth: 1.2,
    borderRadius: 10,
    padding: 12,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#f8fafc',
    fontWeight: '700',
  },
});
