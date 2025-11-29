import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tum-mock-token';

type TumEvent = {
  title: string;
  date?: string;
  url?: string;
  image?: string;
  category?: string;
  loc?: string;
  going?: number;
};

type MensaItem = {
  name: string;
  side?: string;
  price?: string;
  type?: 'meat' | 'vegan' | 'veg' | 'fish' | 'other';
};

const STORIES = [
  { id: 'campus', user: 'Campus Daily', img: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=300&q=80', live: true },
  { id: 'club', user: 'Hacker Club', img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=300&q=80', live: true },
  { id: 'sports', user: 'Sports Team', img: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=300&q=80', live: false },
];

const FALLBACK_EVENTS: TumEvent[] = [
  {
    title: 'Global AI Hackathon 2025 🏆',
    date: 'Thu–Sat',
    loc: 'Innovation Hub',
    category: 'Competition',
    going: 400,
    image: 'https://images.unsplash.com/photo-1504384308090-c54be3855833?w=1200&q=80',
  },
  {
    title: 'CEO Masterclass: Dieter Schwarz',
    date: 'Tue, 14:00',
    loc: 'Audimax A1',
    category: 'Premium',
    going: 950,
    image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80',
  },
  {
    title: 'Semester Closing Festival',
    date: 'Fri, 22:00',
    loc: 'Club Garden',
    category: 'Party',
    going: 420,
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80',
  },
  {
    title: 'CIT Christmas Party 2025',
    date: 'Dec 20, 19:00',
    loc: 'Campus Lounge',
    category: 'Campus',
    going: 320,
    image: 'https://images.unsplash.com/photo-1513116476489-7635e79feb27?w=1200&q=80',
  },
  {
    title: 'TEDx: Echoes of Change',
    date: 'Jan 12, 18:00',
    loc: 'Main Auditorium',
    category: 'Talk',
    going: 280,
    image: 'https://images.unsplash.com/photo-1529333166433-0000e91b2e5c?w=1200&q=80',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const text = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');

  const [tokenChecked, setTokenChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [events, setEvents] = useState<TumEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [menuDate, setMenuDate] = useState(
    new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date()),
  );
  const [mensaItems, setMensaItems] = useState<MensaItem[]>([]);

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      setHasToken(Boolean(saved));
      setTokenChecked(true);
    })();
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    const fetchMensa = async () => {
      try {
        const response = await fetch(`${API_URL}/api/mensa`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { items: MensaItem[]; date?: string };
        setMensaItems(data.items || []);
        if (data.date) {
          setMenuDate(
            new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(
              new Date(data.date),
            ),
          );
        }
      } catch {
        setMensaItems([]);
      }
    };

    const fetchEvents = async () => {
      setLoadingEvents(true);
      setError(null);
      try {
        const response = await fetch(`${API_URL}/api/tum-events`);
        if (!response.ok) {
          const textResp = await response.text();
          throw new Error(textResp || `HTTP ${response.status}`);
        }
        const data = (await response.json()) as { events: TumEvent[] };
        const withDefaults = (data.events || []).map((e) => ({
          ...e,
          category: e.category || 'Official',
          loc: e.url ? new URL(e.url).hostname : 'TUM',
          going: e.going || Math.floor(Math.random() * 200) + 50,
        }));
        setEvents(withDefaults);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoadingEvents(false);
      }
    };
    fetchEvents();
    fetchMensa();
  }, [hasToken]);

  const eventsToShow = useMemo(() => {
    const list = events.length ? events : FALLBACK_EVENTS;
    return list.slice(0, 5);
  }, [events]);

  useEffect(() => {
    if (!eventsToShow.length) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % eventsToShow.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [eventsToShow.length]);

  const onOpen = async (url?: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      return;
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
          <ThemedText style={{ color: muted }}>Sign in to view home.</ThemedText>
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
        <LinearGradient
          colors={['#0ea5e9', '#6366f1', '#a855f7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <ThemedText type="title" style={{ color: '#f8fafc' }}>
            Welcome back
          </ThemedText>
          <ThemedText style={{ color: '#e2e8f0' }}>See what’s happening on campus.</ThemedText>
        </LinearGradient>

        {/* Stories */}
        <View style={styles.stories}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
            {STORIES.map((story) => (
              <View key={story.id} style={styles.storyItem}>
                <LinearGradient
                  colors={story.live ? ['#f87171', '#f59e0b'] : ['#6366f1', '#a855f7']}
                  style={styles.storyRing}
                >
                  <Image source={{ uri: story.img }} style={styles.storyAvatar} contentFit="cover" />
                </LinearGradient>
                <ThemedText style={styles.storyText}>{story.user}</ThemedText>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Upcoming Events Carousel */}
        <View>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Upcoming Events 🔥
          </ThemedText>
          <View style={styles.carousel}>
            {eventsToShow.map((event, index) => {
              const isActive = index === currentBanner;
              return (
                <TouchableOpacity
                  key={event.title}
                  style={[
                    StyleSheet.absoluteFillObject,
                    styles.carouselSlide,
                    { opacity: isActive ? 1 : 0, zIndex: isActive ? 10 : 0 },
                  ]}
                  activeOpacity={0.9}
                  onPress={() => onOpen(event.url)}
                >
                  <Image source={{ uri: event.image }} style={styles.carouselImage} contentFit="cover" />
                  <View style={styles.carouselOverlay} />
                  <View style={styles.carouselContent}>
                    <ThemedText style={styles.eventBadge}>
                      {event.category || 'Official'} • {event.date || 'TBD'}
                    </ThemedText>
                    <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
                    <View style={styles.eventMeta}>
                      <View style={styles.eventMetaLeft}>
                        <Feather name="map-pin" size={12} color="#e2e8f0" />
                        <ThemedText style={{ color: '#e2e8f0', fontSize: 12 }}>{event.loc || 'TUM'}</ThemedText>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={styles.dots}>
              {eventsToShow.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    { opacity: idx === currentBanner ? 1 : 0.4, width: idx === currentBanner ? 16 : 6 },
                  ]}
                />
              ))}
            </View>
          </View>
          {loadingEvents && (
            <View style={styles.loadingInline}>
              <ActivityIndicator color={accent} />
              <ThemedText style={{ color: muted }}>Loading events…</ThemedText>
            </View>
          )}
          {error ? <ThemedText style={{ color: '#b91c1c' }}>Error: {error}</ThemedText> : null}
        </View>

        {/* Mensa Menu */}
        <View style={{ gap: 8 }}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Mensa Menu 🍽️
            </ThemedText>
            <View style={styles.openPill}>
              <ThemedText style={{ color: '#0f172a', fontWeight: '700', fontSize: 12 }}>{menuDate}</ThemedText>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {(mensaItems.length ? mensaItems : []).map((item, i) => (
              <View key={i} style={[styles.mensaCard, { borderColor: border }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText style={{ fontWeight: '700' }}>{item.name}</ThemedText>
                    <ThemedText style={{ fontWeight: '800', color: '#ea580c' }}>{item.price}</ThemedText>
                  </View>
                  <ThemedText style={{ color: muted, fontSize: 12 }}>{item.side}</ThemedText>
                  <View style={styles.tagPill(item.type)}>
                    <ThemedText style={styles.tagText(item.type)}>
                      {item.type === 'vegan' ? 'Vegan' : item.type === 'meat' ? 'Meat' : 'Meal'}
                    </ThemedText>
                  </View>
                </View>
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
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  hero: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  stories: {
    marginTop: -4,
  },
  storiesRow: {
    gap: 12,
    paddingVertical: 4,
  },
  storyItem: {
    alignItems: 'center',
    gap: 6,
  },
  storyRing: {
    width: 64,
    height: 64,
    padding: 2,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  storyText: {
    fontSize: 11,
    color: '#475569',
    width: 64,
    textAlign: 'center',
  },
  sectionTitle: {
    fontWeight: '800',
    fontSize: 16,
  },
  carousel: {
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    backgroundColor: '#0f172a',
  },
  carouselSlide: {
    transform: [{ scale: 1 }],
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  carouselContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    gap: 6,
  },
  eventBadge: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  eventTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
  },
  eventMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  goingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    right: 14,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f8fafc',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mensaCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 10,
    gap: 8,
    flexDirection: 'row',
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  mensaImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    marginRight: 8,
  },
  tagPill: (type: string) => ({
    alignSelf: 'flex-start',
    backgroundColor: type === 'vegan' ? '#dcfce7' : type === 'meat' ? '#fee2e2' : '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  }),
  tagText: (type: string) => ({
    color: type === 'vegan' ? '#15803d' : type === 'meat' ? '#b91c1c' : '#4338ca',
    fontWeight: '700',
    fontSize: 12,
  }),
});
