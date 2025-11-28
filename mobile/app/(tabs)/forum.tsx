import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tum-mock-token';

type Category = 'all' | 'market' | 'qa' | 'discussion';

type ForumPost = {
  id: string;
  title: string;
  body: string;
  category: 'market' | 'qa' | 'discussion';
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    faculty: string | null;
  };
  commentsCount: number;
};

export default function ForumScreen() {
  const router = useRouter();
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const text = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');

  const [tokenChecked, setTokenChecked] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [category, setCategory] = useState<Category>('all');

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      setToken(saved);
      setTokenChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = category !== 'all' ? `?category=${category}` : '';
        const response = await fetch(`${API_URL}/forum/posts${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const txt = await response.text();
          throw new Error(txt || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as { posts: ForumPost[] };
        setPosts(data.posts || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [token, category]);

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

  const categories = useMemo(
    () => [
      { key: 'all', label: 'All' },
      { key: 'market', label: 'Market' },
      { key: 'qa', label: 'Q&A' },
      { key: 'discussion', label: 'Discussion' },
    ] as const,
    [],
  );

  if (!tokenChecked) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={[styles.loading, { backgroundColor: card }]}>
          <ActivityIndicator color={accent} />
          <ThemedText style={{ color: muted }}>Checking session…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={[styles.gateCard, { borderColor: border }]}>
          <ThemedText type="title">Login required</ThemedText>
          <ThemedText style={{ color: muted }}>Sign in to view the forum.</ThemedText>
          <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={() => router.push('/profile')}>
            <ThemedText style={{ color: text, fontWeight: '700' }}>Go to login</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="title">Forum</ThemedText>
          <TouchableOpacity style={[styles.plus, { backgroundColor: accent }]} onPress={() => router.push('/forum/new')}>
            <ThemedText style={{ color: '#f8fafc', fontWeight: '800', fontSize: 18 }}>+</ThemedText>
          </TouchableOpacity>
        </View>
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

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={accent} />
            <ThemedText style={{ color: muted }}>Loading posts…</ThemedText>
          </View>
        ) : error ? (
          <View style={[styles.card, { borderColor: border }]}>
            <ThemedText style={{ color: '#b91c1c' }}>Error: {error}</ThemedText>
          </View>
        ) : (
          <View style={styles.list}>
            {posts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={[styles.card, { borderColor: border }]}
                onPress={() => router.push(`/forum/${post.id}`)}
              >
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.category}>{post.category}</ThemedText>
                  <ThemedText style={{ color: muted }}>{relativeTime(post.createdAt)}</ThemedText>
                </View>
                <ThemedText type="defaultSemiBold">{post.title}</ThemedText>
                <ThemedText style={{ color: muted }}>
                  {post.body.length > 120 ? `${post.body.slice(0, 120)}…` : post.body}
                </ThemedText>
                <View style={styles.meta}>
                  <ThemedText style={{ color: muted }}>{post.author.fullName}</ThemedText>
                  <ThemedText style={{ color: muted }}>{post.commentsCount} comments</ThemedText>
                </View>
              </TouchableOpacity>
            ))}
            {posts.length === 0 ? (
              <ThemedText style={{ color: muted }}>No posts yet. Start one!</ThemedText>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  category: {
    textTransform: 'uppercase',
    letterSpacing: 0.08,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  list: {
    gap: 10,
  },
  loading: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  gateCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    margin: 16,
  },
  button: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
