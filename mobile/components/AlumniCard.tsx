// components/AlumniCard.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Avatar from "./Avatar";
import { colors, radius, spacing } from "../constants/theme";

export type AlumniUser = {
  roll_number: string;
  name: string;
  branch?: string;
  batch_year?: number;
  role?: string;
  company?: string;
  avatar_url?: string;
  skills?: string[];
};

export default function AlumniCard({ user, onView, onMessage }: {
  user: AlumniUser;
  onView: (roll: string) => void;
  onMessage: (roll: string) => void;
}) {
  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={() => onView(user.roll_number)}>
        <Avatar name={user.name} avatarUrl={user.avatar_url} size={46} />
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <TouchableOpacity onPress={() => onView(user.roll_number)}>
          <Text style={styles.name}>{user.name}</Text>
        </TouchableOpacity>
        <Text style={styles.meta}>{user.branch} · Batch {user.batch_year}</Text>
        {!!user.company && <Text style={styles.company}>🏢 {user.company}</Text>}
      </View>
      <View style={{ gap: 6 }}>
        <TouchableOpacity style={styles.btn} onPress={() => onView(user.roll_number)}>
          <Text style={styles.btnText}>View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => onMessage(user.roll_number)}>
          <Text style={styles.btnText}>Message</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.ink3,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  name: { color: colors.textOnDark, fontWeight: "600", fontSize: 14 },
  meta: { color: colors.textOnDark3, fontSize: 12, marginTop: 2 },
  company: { color: colors.textOnDark2, fontSize: 11.5, marginTop: 2 },
  btn: {
    borderWidth: 1, borderColor: colors.purple, borderRadius: radius.sm,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  btnText: { color: colors.purple3, fontSize: 11.5, fontWeight: "600" },
});
