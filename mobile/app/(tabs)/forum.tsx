import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

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
      { key: 'market', label: 'Marketplace' },
      { key: 'qa', label: 'Academic Q&A' },
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
        <LinearGradient
          colors={['#e0e7ff', '#ede9fe']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroInner}>
            <View style={{ gap: 6 }}>
              <ThemedText type="title" style={{ color: '#312e81' }}>
                Student Forum 💬
              </ThemedText>
              <ThemedText style={{ color: '#4338ca' }}>
                Discuss, trade, and connect with peers.
              </ThemedText>
              <View style={styles.heroActions}>
                <TouchableOpacity style={styles.newPostBtn} onPress={() => router.push('/forum/new')}>
                  <Feather name="message-square" size={14} color="#f8fafc" />
                  <ThemedText style={{ color: '#f8fafc', fontWeight: '700', fontSize: 12 }}>New Post</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
            <Feather name="users" size={32} color="#4338ca" />
          </View>
        </LinearGradient>

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
              <ThemedText style={{ color: category === c.key ? '#fff' : '#475569', fontWeight: '700' }}>{c.label}</ThemedText>
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
                style={[styles.card, { borderColor: border, backgroundColor: card }]}
                onPress={() => router.push(`/forum/${post.id}`)}
                activeOpacity={0.9}
              >
                <View style={styles.postHeader}>
                  <View style={styles.avatarCircle}>
                    <ThemedText style={{ color: '#0f172a', fontWeight: '800' }}>
                      {post.author.fullName?.slice(0, 1).toUpperCase() || 'T'}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText style={{ fontWeight: '700' }}>{post.author.fullName}</ThemedText>
                    <ThemedText style={{ color: muted, fontSize: 12 }}>{relativeTime(post.createdAt)}</ThemedText>
                  </View>
                  <View style={styles.tag}>
                    <ThemedText style={{ color: '#4338ca', fontWeight: '700', fontSize: 11 }}>
                      {post.category}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>{post.title}</ThemedText>
                <ThemedText style={{ color: muted }} numberOfLines={2}>
                  {post.body}
                </ThemedText>
                <View style={styles.postMeta}>
                  <View style={styles.metaLeft}>
                    <Feather name="heart" size={14} color={muted} />
                    <Feather name="message-circle" size={14} color={muted} />
                    <ThemedText style={{ color: muted, fontSize: 12 }}>{post.commentsCount} comments</ThemedText>
                  </View>
                  <Feather name="chevron-right" size={16} color={muted} />
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
  hero: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  heroInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroPills: {
    flexDirection: 'row',
    gap: 8,
  },
  heroPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  searchBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newPostBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
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
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  category: {
    textTransform: 'uppercase',
    letterSpacing: 0.08,
    fontSize: 12,
    fontWeight: '700',
  },
  tag: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaPill: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
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
