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
  const [faculty, setFaculty] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const accent = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const card = useThemeColor({}, 'card');

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
          faculty: faculty.trim() || null,
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
              <TextInput
                style={[styles.input, { borderColor: border, color: text }]}
                placeholder="Faculty (optional)"
                placeholderTextColor={muted}
                value={faculty}
                onChangeText={setFaculty}
              />
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <ThemedText type="title">Profile</ThemedText>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <ThemedText style={{ fontSize: 22 }}>⚙️</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, { borderColor: border }]}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={styles.initials}>
                <ThemedText type="defaultSemiBold" style={{ color: '#0f172a' }}>
                  {initials}
                </ThemedText>
              </View>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <ThemedText type="title">{user.fullName}</ThemedText>
              <ThemedText style={{ color: muted }}>{user.faculty || 'Faculty not set'}</ThemedText>
              <ThemedText style={{ color: muted }}>{user.tumId || 'Program not set'}</ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.card, { borderColor: border }]}>
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
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    gap: 10,
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
