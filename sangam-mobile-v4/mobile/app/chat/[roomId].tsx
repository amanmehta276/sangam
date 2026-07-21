// app/chat/[roomId].tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, TextInput, TouchableOpacity, FlatList, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChatAPI } from "../../constants/api";
import { useAuth } from "../../hooks/useAuth";
import ChatBubble, { ChatMessage } from "../../components/ChatBubble";
import { colors, radius, spacing } from "../../constants/theme";

const POLL_INTERVAL = 4000;

export default function ChatRoomScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const lastTimeRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadInitial = useCallback(async () => {
    try {
      const msgs = await ChatAPI.getMessages(roomId);
      setMessages(msgs || []);
      if (msgs?.length) lastTimeRef.current = msgs[msgs.length - 1].created_at;
    } catch {
      // silent — empty state will show
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const poll = useCallback(async () => {
    try {
      const newMsgs = await ChatAPI.getMessages(roomId, lastTimeRef.current || undefined);
      if (newMsgs?.length) {
        setMessages((prev) => [...prev, ...newMsgs]);
        lastTimeRef.current = newMsgs[newMsgs.length - 1].created_at;
      }
    } catch {
      // silent — retry next tick
    }
  }, [roomId]);

  useEffect(() => {
    loadInitial();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadInitial, poll]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setSending(true);
    try {
      const msg = await ChatAPI.sendMessage(roomId, text);
      setMessages((prev) => [...prev, msg]);
      lastTimeRef.current = msg.created_at;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setInput(text); // put it back so the user doesn't lose their message
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.purple} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const mine = item.sender === user?.roll_number;
            const prevSender = messages[index - 1]?.sender;
            return <ChatBubble message={item} mine={mine} showSender={prevSender !== item.sender} />;
          }}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message…"
          placeholderTextColor={colors.textOnDark3}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", padding: spacing.md, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.borderDark,
  },
  input: {
    flex: 1, backgroundColor: colors.ink3, borderRadius: 18, paddingHorizontal: spacing.md,
    paddingVertical: 10, color: colors.textOnDark, fontSize: 14, maxHeight: 100,
    borderWidth: 1, borderColor: colors.borderDark,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.purple,
    alignItems: "center", justifyContent: "center",
  },
});
