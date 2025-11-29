import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'tum-mock-token';

type Student = { id: string; fullName: string; email: string; faculty: string | null };
type ChatSummary = {
  id: string;
  members: Array<{ id: string; fullName: string; email: string }>;
  lastMessage?: { id: string; body: string; createdAt: string; senderId: string };
};
type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; fullName: string; email: string };
};

export default function MessagesScreen() {
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({ light: '#475569', dark: '#94a3b8' }, 'text');
  const text = useThemeColor({}, 'text');
  const card = useThemeColor({}, 'card');
  const accent = useThemeColor({}, 'tint');

  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [sending, setSending] = useState(false);
  const [composed, setComposed] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const messagesRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(TOKEN_KEY);
      setToken(saved);
      setTokenChecked(true);
    })();
  }, []);

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

  const fetchChats = async () => {
    if (!token) return;
    setLoadingChats(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/chats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { chats: ChatSummary[] };
      setChats(data.chats || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chats');
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchStudents = async () => {
    if (!token) return;
    setLoadingStudents(true);
    try {
      const response = await fetch(`${API_URL}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { users: Student[] };
      setStudents(data.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (token) {
      (async () => {
        try {
          const response = await fetch(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setCurrentUserId(data.user?.id ?? null);
          }
        } catch {
          setCurrentUserId(null);
        }
      })();
      fetchChats();
      fetchStudents();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const chatInterval = setInterval(fetchChats, 5000);
    return () => clearInterval(chatInterval);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedChat) return;
    const chatId = selectedChat.id;
    loadMessages(chatId, { silent: true });
    const msgInterval = setInterval(() => loadMessages(chatId, { silent: true }), 4000);
    return () => clearInterval(msgInterval);
  }, [selectedChat, token]);

  useEffect(() => {
    if (messagesRef.current && selectedChat) {
      setTimeout(() => messagesRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages, selectedChat]);

  const loadMessages = async (chatId: string, { silent }: { silent?: boolean } = {}) => {
    if (!token) return;
    if (!silent) {
      setLoadingMessages(true);
      setMessages([]);
    }
    try {
      const response = await fetch(`${API_URL}/chats/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { messages: ChatMessage[] };
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const openChat = async (chat: ChatSummary) => {
    setSelectedChat(chat);
    await loadMessages(chat.id, { silent: false });
  };

  const startChat = async () => {
    if (!selectedStudent || !token) return;
    try {
      const response = await fetch(`${API_URL}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ participantId: selectedStudent.id }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { chat: ChatSummary };
      setShowNew(false);
      setSelectedStudent(null);
      await fetchChats();
      openChat(data.chat);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start chat');
    }
  };

  const sendMessage = async () => {
    if (!token || !selectedChat || !composed.trim()) return;
    setSending(true);
    try {
      const response = await fetch(`${API_URL}/chats/${selectedChat.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: composed }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: data.message.id,
          body: data.message.body,
          createdAt: data.message.createdAt,
          sender: { id: currentUserId || data.message.senderId, fullName: 'You', email: '' },
        },
      ]);
      setComposed('');
      fetchChats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const chatTitle = useMemo(() => {
    if (!selectedChat) return '';
    return selectedChat.members.map((m) => m.fullName).join(', ');
  }, [selectedChat]);

  if (!tokenChecked) {
    return null;
  }

  if (!token) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: card }]} edges={['top', 'left', 'right']}>
        <View style={[styles.loading, { backgroundColor: card }]}>
          <ActivityIndicator color={accent} />
          <ThemedText style={{ color: muted }}>Login required to use messages.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: card }]} edges={['top', 'left', 'right']}>
      {!selectedChat ? (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          <View style={[styles.listHeader, { borderColor: border }]}>
            <ThemedText type="title">Messages</ThemedText>
            <TouchableOpacity style={[styles.newChatBtn, { borderColor: border }]} onPress={() => setShowNew((p) => !p)}>
              <Feather name="user-plus" size={16} color={accent} />
              <ThemedText style={{ color: accent, fontWeight: '700' }}>New chat</ThemedText>
            </TouchableOpacity>
          </View>

          {showNew ? (
            <View style={[styles.card, { borderColor: border }]}>
              <ThemedText type="subtitle">Start a chat</ThemedText>
              {loadingStudents ? (
                <ActivityIndicator color={accent} />
              ) : (
                <View style={{ gap: 8 }}>
                  {students.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.studentRow,
                        { borderColor: border, backgroundColor: selectedStudent?.id === s.id ? '#eef2ff' : '#fff' },
                      ]}
                      onPress={() => setSelectedStudent(s)}
                    >
                      <View style={styles.avatarWrap}>
                        <Feather name="user" size={16} color={muted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText>{s.fullName}</ThemedText>
                        <ThemedText style={{ color: muted, fontSize: 12 }}>{s.email}</ThemedText>
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: accent, opacity: selectedStudent ? 1 : 0.6 }]}
                    disabled={!selectedStudent}
                    onPress={startChat}
                  >
                    <ThemedText style={{ color: '#f8fafc', fontWeight: '700' }}>Start chat</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null}

          {loadingChats ? (
            <View style={styles.loading}>
              <ActivityIndicator color={accent} />
              <ThemedText style={{ color: muted }}>Loading chats…</ThemedText>
            </View>
          ) : (
            chats.map((chat) => (
              <TouchableOpacity key={chat.id} style={[styles.chatRow, { borderColor: border }]} onPress={() => openChat(chat)}>
                <View style={styles.avatarWrap}>
                  <Feather name="user" size={18} color={muted} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.chatRowTop}>
                    <ThemedText style={{ fontWeight: '700' }}>
                      {chat.members.map((m) => m.fullName).join(', ')}
                    </ThemedText>
                    {chat.lastMessage ? (
                      <ThemedText style={{ color: muted, fontSize: 12 }}>{relativeTime(chat.lastMessage.createdAt)}</ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={{ color: muted }} numberOfLines={1}>
                    {chat.lastMessage ? chat.lastMessage.body : 'No messages yet'}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))
          )}
          {error ? <ThemedText style={{ color: '#b91c1c' }}>Error: {error}</ThemedText> : null}
        </ScrollView>
      ) : (
        <View style={[styles.chatDetail, { backgroundColor: '#efeae2' }]}>
          <View style={[styles.detailHeader, { borderColor: border }]}>
            <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backBtn}>
              <Feather name="arrow-left" size={18} color={accent} />
              <ThemedText style={{ color: accent }}>Back</ThemedText>
            </TouchableOpacity>
            <ThemedText style={{ fontWeight: '700' }} numberOfLines={1}>
              {chatTitle}
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView
            ref={messagesRef}
            contentContainerStyle={styles.messages}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => messagesRef.current?.scrollToEnd({ animated: true })}
          >
            {loadingMessages ? (
              <View style={styles.loading}>
                <ActivityIndicator color={accent} />
                <ThemedText style={{ color: muted }}>Loading…</ThemedText>
              </View>
            ) : (
              messages.map((m) => {
                const isMe = currentUserId ? m.sender.id === currentUserId : false;
                return (
                  <View key={m.id} style={isMe ? styles.outgoing : styles.incoming}>
                    <ThemedText>{m.body}</ThemedText>
                    <ThemedText style={styles.msgTime}>{relativeTime(m.createdAt)}</ThemedText>
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={[styles.inputRow, { borderColor: border }]}>
            <TextInput
              style={[styles.input, { color: text }]}
              placeholder="Message..."
              placeholderTextColor={muted}
              value={composed}
              onChangeText={setComposed}
            />
            <TouchableOpacity style={styles.iconBtn} onPress={sendMessage} disabled={sending || !composed.trim()}>
              {sending ? <ActivityIndicator color={accent} /> : <Feather name="send" size={18} color={accent} />}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  list: { padding: 16, gap: 10 },
  listHeader: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unread: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatDetail: {
    flex: 1,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
  },
  studentRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  messages: {
    gap: 10,
    padding: 12,
  },
  incoming: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 12,
    borderTopLeftRadius: 2,
  },
  outgoing: {
    alignSelf: 'flex-end',
    backgroundColor: '#dcf8c6',
    padding: 10,
    borderRadius: 12,
    borderTopRightRadius: 2,
  },
  msgTime: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconBtn: {
    padding: 8,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  loading: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
});
