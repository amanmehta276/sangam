// components/Avatar.tsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { getAvatarColor } from "../constants/theme";

export default function Avatar({
  name,
  avatarUrl,
  size = 44,
}: {
  name?: string;
  avatarUrl?: string;
  size?: number;
}) {
  const initial = (name || "?")[0]?.toUpperCase() || "?";
  const color = getAvatarColor(initial);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View style={[styles.base, styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden" },
  fallback: { alignItems: "center", justifyContent: "center" },
});
