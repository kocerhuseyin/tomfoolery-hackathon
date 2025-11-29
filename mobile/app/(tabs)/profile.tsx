import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tum-mock-token';

type User = {
  id: string;
  tumId: string | null;
  email: string;
  fullName: string;
  faculty: string | null;
  semester?: number | null;
  profileSlug: string;
  authProvider: 'mock' | 'tum';
  createdAt: string;
  updatedAt: string;
};

const activities = [
  { title: 'Joined TUM Social', time: 'Just now' },
  { title: 'Followed CIT AI Club', time: '5m ago' },
  { title: 'RSVP’d to Hack Night', time: '15m ago' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [tumId, setTumId] = useState('');
  const [faculty, setFaculty] = useState<'CIT' | 'SOM' | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const accent = useThemeColor({}, 'tint');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      if (saved) {
        setToken(saved);
        await fetchProfile(saved);
      }
      setLoading(false);
    })();
  }, []);

  const initials = useMemo(() => {
    if (!user?.fullName) return 'TU';
    return user.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'TU';
  }, [user]);

  const avatarUri = useMemo(
    () => `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(user?.email || 'tum')}`,
    [user],
  );

  const fetchProfile = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as { user: User };
      setUser(data.user);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to load profile');
      setUser(null);
    }
  };

  const onLogin = async () => {
    const safeEmail = email.trim();
    const safeName = fullName.trim();
    if (!safeEmail || !safeName) {
      setAuthError('Enter your TUM email and full name.');
      return;
    }
    if (!faculty) {
      setAuthError('Select faculty.');
      return;
    }

    setSubmitting(true);
    setAuthError(null);
    try {
      const response = await fetch(`${API_URL}/auth/mock-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: safeEmail,
          fullName: safeName,
          tumId: tumId.trim() || null,
          faculty,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as { token: string; user: User };
      setToken(data.token);
      setUser(data.user);
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await fetchProfile(data.token);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={[styles.loadingCard, { backgroundColor: card }]}>
          <ActivityIndicator color={accent} />
          <ThemedText style={{ color: muted }}>Checking session…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!token || !user) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { borderColor: border }]}>
            <ThemedText type="title">Login</ThemedText>
            <ThemedText style={{ color: muted }}>Sign in to view your profile.</ThemedText>
            <View style={styles.form}>
              <TextInput
                style={[styles.input, { borderColor: border, color: text }]}
                placeholder="Full name"
                placeholderTextColor={muted}
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                style={[styles.input, { borderColor: border, color: text }]}
                placeholder="TUM email"
                placeholderTextColor={muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={[styles.input, { borderColor: border, color: text }]}
                placeholder="TUM ID (optional)"
                placeholderTextColor={muted}
                value={tumId}
                onChangeText={setTumId}
                autoCapitalize="none"
              />
            <ThemedText style={{ color: muted }}>Select faculty</ThemedText>
            <View style={styles.chipRow}>
              {(['CIT', 'SOM'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.chip,
                    { borderColor: border, backgroundColor: faculty === f ? accent : 'transparent' },
                  ]}
                  onPress={() => setFaculty(f)}
                >
                  <ThemedText style={{ color: faculty === f ? '#f8fafc' : text }}>{f}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: accent }]}
              onPress={onLogin}
              disabled={submitting}
            >
                {submitting ? (
                  <ActivityIndicator color="#f8fafc" />
                ) : (
                  <ThemedText style={styles.buttonText}>Login with TUM (Prototype)</ThemedText>
                )}
              </TouchableOpacity>
            </View>
            {authError ? (
              <ThemedText style={[styles.error, { color: '#b91c1c' }]}>Auth error: {authError}</ThemedText>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: card }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#0ea5e9', '#6366f1', '#a855f7']}
          start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroHeader}>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <ThemedText style={{ fontSize: 22, color: '#f8fafc' }}>⚙️</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.heroProfile}>
          <View style={styles.avatarWrap}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            <View style={styles.initials}>
              <ThemedText type="defaultSemiBold" style={{ color: '#0f172a' }}>
                  {initials}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="title" style={{ color: '#f8fafc', textAlign: 'center' }}>
              {user.fullName}
            </ThemedText>
            <ThemedText style={{ color: '#e2e8f0' }}>{user.faculty || 'Faculty not set'}</ThemedText>
            <ThemedText style={{ color: '#e2e8f0' }}>{user.tumId || 'ID not set'}</ThemedText>
          </View>
        </LinearGradient>

        <View style={[styles.card, { borderColor: border, backgroundColor: card }]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">Recent activity</ThemedText>
          </View>
          <View style={styles.activityList}>
            {activities.map((item) => (
              <View key={item.title} style={[styles.activityItem, { borderColor: border }]}>
                <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                <ThemedText style={{ color: muted }}>{item.time}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hero: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  heroProfile: {
    alignItems: 'center',
    gap: 8,
  },
  heroHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  profileRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#e2e8f0',
  },
  initials: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityList: {
    gap: 8,
  },
  activityItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  form: {
    gap: 10,
    marginTop: 10,
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  error: {
    marginTop: 6,
    fontWeight: '600',
  },
  loadingCard: {
    marginTop: 40,
    alignSelf: 'center',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
});
