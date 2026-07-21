// components/EmptyState.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../constants/theme";

export default function EmptyState({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.text, { color: dark ? colors.textOnDark3 : colors.text3 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 32, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 13.5, textAlign: "center" },
});
