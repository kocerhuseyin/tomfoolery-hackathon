import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

type CrawlResponse = {
  startUrl: string;
  maxPages: number;
  maxDepth: number;
  sameDomain: boolean;
  pages: Array<{
    url: string;
    status?: number;
    title?: string;
    description?: string;
    links: string[];
    error?: string;
  }>;
};

export default function CrawlScreen() {
  const [health, setHealth] = useState<'loading' | 'ok' | 'error'>('loading');
  const [healthMsg, setHealthMsg] = useState('Checking backend…');

  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<CrawlResponse | null>(null);
  const [maxPages, setMaxPages] = useState(5);
  const [maxDepth, setMaxDepth] = useState(1);
  const [sameDomain, setSameDomain] = useState(true);

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

  const onCrawl = async () => {
    if (!crawlUrl.trim()) {
      setCrawlError('Enter a URL');
      return;
    }
    setCrawlLoading(true);
    setCrawlError(null);
    setCrawlResult(null);
    try {
      const response = await fetch(`${API_URL}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: crawlUrl.trim(),
          maxPages,
          maxDepth,
          sameDomain,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const data = (await response.json()) as CrawlResponse;
      setCrawlResult(data);
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : 'Crawl failed');
    } finally {
      setCrawlLoading(false);
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
            <ThemedText type="subtitle">Mini Crawler</ThemedText>
            <ThemedText style={{ color: muted }}>Follow links within limits.</ThemedText>
            <TextInput
              style={[styles.input, { borderColor: border, color: text }]}
              placeholder="https://example.com"
              placeholderTextColor={muted}
              value={crawlUrl}
              onChangeText={setCrawlUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.inputInline, { borderColor: border, color: text }]}
                placeholder="Pages (1-20)"
                placeholderTextColor={muted}
                keyboardType="numeric"
                value={String(maxPages)}
                onChangeText={(v) => setMaxPages(Math.min(Math.max(Number(v) || 1, 1), 20))}
              />
              <TextInput
                style={[styles.inputInline, { borderColor: border, color: text }]}
                placeholder="Depth (0-3)"
                placeholderTextColor={muted}
                keyboardType="numeric"
                value={String(maxDepth)}
                onChangeText={(v) => setMaxDepth(Math.min(Math.max(Number(v) || 0, 0), 3))}
              />
            </View>
            <View style={styles.switchRow}>
              <ThemedText style={{ color: muted }}>Stay on same domain</ThemedText>
              <Switch value={sameDomain} onValueChange={setSameDomain} />
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: accent }]}
              onPress={onCrawl}
              disabled={crawlLoading}
            >
              {crawlLoading ? (
                <ActivityIndicator color="#f8fafc" />
              ) : (
                <ThemedText style={styles.buttonText}>Crawl</ThemedText>
              )}
            </TouchableOpacity>
            {crawlError ? (
              <ThemedText style={[styles.error, { color: error }]}>Error: {crawlError}</ThemedText>
            ) : null}
            {crawlResult ? (
              <View style={[styles.resultCard, { borderColor: border }]}>
                <ThemedText style={styles.url}>{crawlResult.startUrl}</ThemedText>
                <ThemedText style={{ color: muted }}>
                  pages {crawlResult.pages.length}/{crawlResult.maxPages} • depth {crawlResult.maxDepth} • same domain{' '}
                  {crawlResult.sameDomain ? 'yes' : 'no'}
                </ThemedText>
                <FlatList
                  data={crawlResult.pages}
                  keyExtractor={(item) => item.url}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <View style={[styles.pageItem, { borderColor: border }]}>
                      <ThemedText type="defaultSemiBold">{item.title || item.url}</ThemedText>
                      <ThemedText style={{ color: muted }}>HTTP {item.status ?? 'n/a'}</ThemedText>
                      {item.description ? (
                        <ThemedText style={{ color: muted }}>{item.description}</ThemedText>
                      ) : null}
                      {item.error ? (
                        <ThemedText style={[styles.error, { color: error }]}>Error: {item.error}</ThemedText>
                      ) : null}
                    </View>
                  )}
                />
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
  inputInline: {
    flex: 1,
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
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 4,
  },
});
