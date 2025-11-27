import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

type ScrapeResponse = {
  url: string;
  status?: number;
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  textPreview?: string;
  headings?: string[];
  links?: string[];
  error?: string;
};

export default function ScrapeScreen() {
  const [health, setHealth] = useState<'loading' | 'ok' | 'error'>('loading');
  const [healthMsg, setHealthMsg] = useState('Checking backend…');

  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResponse | null>(null);

  const accent = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const error = '#ef4444';

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setHealth('ok');
        setHealthMsg(data.message ?? 'Backend OK');
      })
      .catch((err) => {
        setHealth('error');
        setHealthMsg(err instanceof Error ? err.message : 'Failed to reach backend');
      });
  }, []);

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      return;
    }
  };

  const onScrape = async () => {
    if (!scrapeUrl.trim()) {
      setScrapeError('Enter a URL');
      return;
    }
    setScrapeLoading(true);
    setScrapeError(null);
    setScrapeResult(null);
    try {
      const response = await fetch(`${API_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl.trim() }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as ScrapeResponse;
      setScrapeResult(data);
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'Scrape failed');
    } finally {
      setScrapeLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.statusBar, { borderColor: border }]}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.dot,
                  health === 'ok' ? styles.dotOk : styles.dotError,
                  health === 'loading' ? styles.dotLoading : null,
                ]}
              />
              <ThemedText style={{ fontWeight: '600' }}>{healthMsg}</ThemedText>
            </View>
            <ThemedText style={{ color: muted, fontSize: 13 }}>API: {API_URL}</ThemedText>
          </View>

          <View style={[styles.card, { borderColor: border }]}>
            <ThemedText type="subtitle">Scrape a Page</ThemedText>
            <ThemedText style={{ color: muted }}>
              Get title, meta, headings, preview, and links.
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: border, color: text }]}
              placeholder="https://example.com"
              placeholderTextColor={muted}
              value={scrapeUrl}
              onChangeText={setScrapeUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.button, { backgroundColor: accent }]}
              onPress={onScrape}
              disabled={scrapeLoading}
            >
              {scrapeLoading ? (
                <ActivityIndicator color="#f8fafc" />
              ) : (
                <ThemedText style={styles.buttonText}>Scrape</ThemedText>
              )}
            </TouchableOpacity>
            {scrapeError ? (
              <ThemedText style={[styles.error, { color: error }]}>Error: {scrapeError}</ThemedText>
            ) : null}
            {scrapeResult ? (
              <View style={[styles.resultCard, { borderColor: border }]}>
                <ThemedText style={styles.url}>{scrapeResult.url}</ThemedText>
                <ThemedText style={{ color: muted }}>HTTP {scrapeResult.status ?? 'n/a'}</ThemedText>
                {scrapeResult.title ? <ThemedText type="subtitle">{scrapeResult.title}</ThemedText> : null}
                {scrapeResult.description ? (
                  <ThemedText style={{ color: muted }}>{scrapeResult.description}</ThemedText>
                ) : null}
                {scrapeResult.ogTitle ? (
                  <ThemedText style={{ color: muted }}>OG: {scrapeResult.ogTitle}</ThemedText>
                ) : null}
                {scrapeResult.ogDescription ? (
                  <ThemedText style={{ color: muted }}>OG Desc: {scrapeResult.ogDescription}</ThemedText>
                ) : null}
                {scrapeResult.textPreview ? (
                  <ThemedText style={{ color: muted }}>Preview: {scrapeResult.textPreview}</ThemedText>
                ) : null}
                {scrapeResult.headings?.length ? (
                  <View style={styles.section}>
                    <ThemedText type="defaultSemiBold">Headings</ThemedText>
                    {scrapeResult.headings.slice(0, 8).map((h) => (
                      <ThemedText key={h}>• {h}</ThemedText>
                    ))}
                    {scrapeResult.headings.length > 8 ? (
                      <ThemedText style={{ color: muted }}>
                        +{scrapeResult.headings.length - 8} more
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
                {scrapeResult.links?.length ? (
                  <View style={styles.section}>
                    <ThemedText type="defaultSemiBold">Links</ThemedText>
                    <View style={styles.chipList}>
                      {scrapeResult.links.slice(0, 8).map((l) => (
                        <TouchableOpacity key={l} onPress={() => openLink(l)}>
                          <ThemedText style={styles.chip}>{l}</ThemedText>
                        </TouchableOpacity>
                      ))}
                      {scrapeResult.links.length > 8 ? (
                        <ThemedText style={{ color: muted }}>
                          +{scrapeResult.links.length - 8} more
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: { flex: 1 },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  statusBar: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOk: {
    backgroundColor: '#22c55e',
  },
  dotError: {
    backgroundColor: '#ef4444',
  },
  dotLoading: {
    backgroundColor: '#fbbf24',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  input: {
    borderWidth: 1,
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
    fontWeight: '600',
  },
  resultCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  url: {
    fontWeight: '700',
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#e2e8f0',
    padding: 6,
    borderRadius: 6,
  },
  section: {
    gap: 4,
  },
});
