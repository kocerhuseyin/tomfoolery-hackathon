import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const TOKEN_KEY = 'tum-mock-token';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

type Meetup = {
  id: string;
  title: string;
  host: string;
  category: 'hike' | 'bike' | 'food' | 'code' | 'study' | 'social';
  timeInfo: string;
  location: string;
  description: string;
  maxAttendees?: number | null;
  memberCount: number;
  joined: boolean;
};

export default function MeetupsScreen() {
  const router = useRouter();
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const text = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');

  const [tokenChecked, setTokenChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      setHasToken(Boolean(saved));
      setToken(saved);
      setTokenChecked(true);
    })();
  }, []);

  const fetchMeetups = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/meetups`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as { meetups: Meetup[] };
      setMeetups(data.meetups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetups();
  }, [token]);

  const handleJoin = async (id: string, joined: boolean) => {
    if (!token) return;
    try {
      const endpoint = joined ? 'leave' : 'join';
      const response = await fetch(`${API_URL}/meetups/${id}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || `HTTP ${response.status}`);
      }
      fetchMeetups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update meetup');
    }
  };

  if (!tokenChecked) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: card }]} edges={['top', 'left', 'right']}>
        <View style={[styles.loading, { backgroundColor: card }]}>
          <ActivityIndicator color={accent} />
          <ThemedText style={{ color: muted }}>Checking session…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasToken) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: card }]} edges={['top', 'left', 'right']}>
        <View style={[styles.gateCard, { borderColor: border, backgroundColor: card }]}>
          <ThemedText type="title">Login required</ThemedText>
          <ThemedText style={{ color: muted }}>Sign in to view meetups.</ThemedText>
          <TouchableOpacity style={[styles.loginButton, { backgroundColor: accent }]} onPress={() => router.push('/profile')}>
            <ThemedText style={{ color: text, fontWeight: '700' }}>Go to login</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: card }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="users" size={20} color={accent} />
            <ThemedText type="title">Meetups</ThemedText>
          </View>
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: accent }]}>
            <Feather name="plus" size={14} color="#f8fafc" />
            <ThemedText style={{ color: '#f8fafc', fontWeight: '700', fontSize: 12 }}>Create</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 12 }}>
          {meetups.map((meetup) => {
            const isJoined = meetup.joined;
            const icon =
              meetup.category === 'hike'
                ? 'navigation'
                : meetup.category === 'bike'
                  ? 'watch'
                  : meetup.category === 'food'
                    ? 'coffee'
                    : 'codepen';
            const chipBg =
              meetup.category === 'hike'
                ? '#dcfce7'
                : meetup.category === 'bike'
                  ? '#ffedd5'
                  : meetup.category === 'food'
                    ? '#e0f2fe'
                    : '#ede9fe';
            const chipText =
              meetup.category === 'hike'
                ? '#15803d'
                : meetup.category === 'bike'
                  ? '#c2410c'
                  : meetup.category === 'food'
                    ? '#0ea5e9'
                    : '#4338ca';
            return (
              <View key={meetup.id} style={[styles.card, { borderColor: border }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.iconBox, { backgroundColor: chipBg }]}>
                    <Feather name={icon as any} size={18} color={chipText} />
                  </View>
                  <View style={[styles.chip, { backgroundColor: chipBg }]}>
                    <ThemedText style={{ color: chipText, fontWeight: '700', fontSize: 11 }}>{meetup.timeInfo}</ThemedText>
                  </View>
                </View>
                <ThemedText style={{ fontWeight: '800', fontSize: 16 }}>{meetup.title}</ThemedText>
                <ThemedText style={{ color: muted, fontSize: 12 }}>{meetup.location}</ThemedText>
                {meetup.description ? (
                  <View style={styles.descBox}>
                    <ThemedText style={{ color: muted, fontSize: 12 }}>{meetup.description}</ThemedText>
                  </View>
                ) : null}
                <View style={styles.cardFooter}>
                  <View style={styles.avatarRow}>
                    <View style={styles.avatarCircle}>
                      <ThemedText style={{ fontSize: 10, fontWeight: '800' }}>{meetup.memberCount}</ThemedText>
                    </View>
                    <ThemedText style={{ color: muted, fontSize: 12 }}>members</ThemedText>
                  </View>
                  <TouchableOpacity
                    style={[styles.joinBtn, { backgroundColor: isJoined ? '#dcfce7' : '#eef2ff' }]}
                    onPress={() => handleJoin(meetup.id, isJoined)}
                  >
                    <ThemedText style={{ color: isJoined ? '#15803d' : '#4338ca', fontWeight: '700', fontSize: 12 }}>
                      {isJoined ? 'Joined' : 'Join'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  gateCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    margin: 16,
  },
  loginButton: {
    marginTop: 8,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 14,
    gap: 8,
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  descBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
});
