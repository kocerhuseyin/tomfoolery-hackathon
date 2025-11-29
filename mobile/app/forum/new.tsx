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
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

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
  const card = useThemeColor({}, 'card');

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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: card }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={['#e0e7ff', '#ede9fe']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Feather name="arrow-left" size={18} color="#4338ca" />
                <ThemedText style={{ color: '#4338ca', fontWeight: '700' }}>Back</ThemedText>
              </TouchableOpacity>
              <ThemedText type="title" style={{ color: '#312e81' }}>
                New Post
              </ThemedText>
              <View style={{ width: 60 }} />
            </View>
            <ThemedText style={{ color: '#4338ca' }}>Share with the community.</ThemedText>
          </LinearGradient>

          <View style={[styles.card, { borderColor: border }]}>
            <ThemedText type="subtitle">Category</ThemedText>
            <View style={styles.chips}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[
                    styles.chip,
                    { borderColor: border, backgroundColor: category === c.key ? '#0f172a' : '#fff' },
                  ]}
                  onPress={() => setCategory(c.key)}
                >
                  <ThemedText style={{ color: category === c.key ? '#fff' : muted }}>{c.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <ThemedText type="subtitle">Title</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: border, color: text }]}
              placeholder="What’s on your mind?"
              placeholderTextColor={muted}
              value={title}
              onChangeText={setTitle}
            />
            <ThemedText type="subtitle">Body</ThemedText>
            <TextInput
              style={[styles.textarea, { borderColor: border, color: text }]}
              placeholder="Add details…"
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  hero: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
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
