import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemeToggle } from '@/components/theme-toggle';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tum-mock-token';

export default function SettingsScreen() {
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const text = useThemeColor({}, 'text');
  const accent = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');

  const [tokenChecked, setTokenChecked] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      setHasToken(Boolean(saved));
      setTokenChecked(true);
    })();
  }, []);

  const onLogout = async () => {
    setLoadingAction(true);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setStatus('Logged out');
    setHasToken(false);
    setLoadingAction(false);
    router.replace('/profile');
  };

  const onRefresh = async () => {
    setLoadingAction(true);
    try {
      const response = await fetch(`${API_URL}/api/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus('Backend OK');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to reach backend');
    } finally {
      setLoadingAction(false);
    }
  };

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

  if (!hasToken) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={[styles.card, { borderColor: border }]}>
          <ThemedText type="title">Login required</ThemedText>
          <ThemedText style={{ color: muted }}>Sign in to access settings.</ThemedText>
          <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={() => router.replace('/profile')}>
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
          <TouchableOpacity onPress={() => router.back()}>
            <ThemedText style={{ fontSize: 18 }}>‹ Back</ThemedText>
          </TouchableOpacity>
          <ThemedText type="title">Settings</ThemedText>
          <View style={{ width: 60 }} />
        </View>

        <View style={[styles.card, { borderColor: border }]}>
          <ThemedText type="subtitle">Appearance</ThemedText>
          <View style={styles.row}>
            <ThemedText>Theme</ThemedText>
            <ThemeToggle />
          </View>
        </View>

        <View style={[styles.card, { borderColor: border }]}>
          <ThemedText type="subtitle">Account</ThemedText>
          <TouchableOpacity style={[styles.rowButton, { borderColor: border }]} onPress={onRefresh} disabled={loadingAction}>
            <ThemedText>Refresh backend status</ThemedText>
            {loadingAction ? <ActivityIndicator color={accent} /> : null}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.rowButton, { borderColor: border }]} onPress={onLogout} disabled={loadingAction}>
            <ThemedText style={{ color: '#b91c1c', fontWeight: '700' }}>Log out</ThemedText>
          </TouchableOpacity>
          {status ? <ThemedText style={{ color: muted }}>{status}</ThemedText> : null}
        </View>
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
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowButton: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  loading: {
    marginTop: 40,
    alignSelf: 'center',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
});
