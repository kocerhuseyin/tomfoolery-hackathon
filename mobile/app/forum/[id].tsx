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
import { router, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tum-mock-token';

type ForumPost = {
  id: string;
  title: string;
  body: string;
  category: 'market' | 'qa' | 'discussion';
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    email: string;
    faculty: string | null;
  };
  commentsCount: number;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; fullName: string; email: string };
  }>;
};

export default function ForumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const text = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'tint');

  const [tokenChecked, setTokenChecked] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [post, setPost] = useState<ForumPost | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      setToken(saved);
      setTokenChecked(true);
      if (!saved) router.replace('/profile');
    })();
  }, []);

  useEffect(() => {
    if (!token || !id) return;
    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/forum/posts/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const txt = await response.text();
          throw new Error(txt || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as { post: ForumPost };
        setPost(data.post);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [token, id]);

  const relativeTime = (iso: string) => {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const onComment = async () => {
    if (!token || !id || comment.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/forum/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: comment }),
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || `HTTP ${response.status}`);
      }
      const data = await response.json();
      setPost((prev) =>
        prev
          ? {
              ...prev,
              comments: [
                ...prev.comments,
                {
                  id: data.comment.id,
                  body: data.comment.body,
                  createdAt: data.comment.createdAt,
                  author: data.comment.author,
                },
              ],
              commentsCount: prev.commentsCount + 1,
            }
          : prev,
      );
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!tokenChecked) return null;

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
            <ThemedText type="title">Post</ThemedText>
            <View style={{ width: 60 }} />
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={accent} />
              <ThemedText style={{ color: muted }}>Loading…</ThemedText>
            </View>
          ) : error ? (
            <ThemedText style={{ color: '#b91c1c' }}>Error: {error}</ThemedText>
          ) : post ? (
            <>
              <View style={[styles.card, { borderColor: border }]}>
                <View style={styles.rowBetween}>
                  <ThemedText style={styles.category}>{post.category}</ThemedText>
                  <ThemedText style={{ color: muted }}>{relativeTime(post.createdAt)}</ThemedText>
                </View>
                <ThemedText type="title">{post.title}</ThemedText>
                <ThemedText style={{ color: muted }}>{post.body}</ThemedText>
                <View style={styles.rowBetween}>
                  <ThemedText style={{ color: muted }}>{post.author.fullName}</ThemedText>
                  <ThemedText style={{ color: muted }}>{post.commentsCount} comments</ThemedText>
                </View>
              </View>

              <View style={[styles.card, { borderColor: border }]}>
                <ThemedText type="subtitle">Comments</ThemedText>
                <View style={styles.comments}>
                  {post.comments.map((c) => (
                    <View key={c.id} style={[styles.commentItem, { borderColor: border }]}>
                      <ThemedText style={{ color: muted }}>{c.author.fullName}</ThemedText>
                      <ThemedText>{c.body}</ThemedText>
                      <ThemedText style={{ color: muted, fontSize: 12 }}>{relativeTime(c.createdAt)}</ThemedText>
                    </View>
                  ))}
                  {post.comments.length === 0 ? (
                    <ThemedText style={{ color: muted }}>No comments yet.</ThemedText>
                  ) : null}
                </View>
              </View>

              <View style={[styles.card, { borderColor: border }]}>
                <ThemedText type="subtitle">Add a comment</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: border, color: text }]}
                  placeholder="Write a comment"
                  placeholderTextColor={muted}
                  value={comment}
                  onChangeText={setComment}
                />
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: accent }]}
                  onPress={onComment}
                  disabled={submitting || comment.trim().length === 0}
                >
                  {submitting ? <ActivityIndicator color="#f8fafc" /> : <ThemedText style={styles.buttonText}>Post comment</ThemedText>}
                </TouchableOpacity>
              </View>
            </>
          ) : null}
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
  loading: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  category: {
    textTransform: 'uppercase',
    letterSpacing: 0.08,
    fontSize: 12,
    fontWeight: '700',
  },
  comments: {
    gap: 8,
  },
  commentItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  input: {
    borderWidth: 1.2,
    borderRadius: 10,
    padding: 12,
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
