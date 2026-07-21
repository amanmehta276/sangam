// components/ChatBubble.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../constants/theme";

export type ChatMessage = {
  id: string;
  sender: string;
  sender_name: string;
  content: string;
  created_at: string;
};

export default function ChatBubble({ message, mine, showSender }: {
  message: ChatMessage;
  mine: boolean;
  showSender?: boolean;
}) {
  const time = new Date(message.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      {showSender && !mine && <Text style={styles.sender}>{message.sender_name}</Text>}
      <Text style={mine ? styles.textMine : styles.textTheirs}>{message.content}</Text>
      <Text style={mine ? styles.timeMine : styles.timeTheirs}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "78%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.lg, marginBottom: 8 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.purple, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.ink3, borderBottomLeftRadius: 4 },
  sender: { color: colors.purple3, fontSize: 11, fontWeight: "700", marginBottom: 2 },
  textMine: { color: "#fff", fontSize: 13.5, lineHeight: 18 },
  textTheirs: { color: colors.textOnDark, fontSize: 13.5, lineHeight: 18 },
  timeMine: { color: "rgba(255,255,255,0.7)", fontSize: 9.5, marginTop: 3, alignSelf: "flex-end" },
  timeTheirs: { color: colors.textOnDark3, fontSize: 9.5, marginTop: 3, alignSelf: "flex-end" },
});
