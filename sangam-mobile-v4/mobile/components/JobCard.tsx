// components/JobCard.tsx
import React from "react";
import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../constants/theme";

export type Job = {
  id: string;
  title: string;
  company: string;
  location?: string;
  job_type?: string;
  referral?: boolean;
  skills?: string[];
  apply_link?: string;
  posted_by?: { name: string };
};

export default function JobCard({ job }: { job: Job }) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.company}>{job.company} {job.location ? `· ${job.location}` : ""}</Text>
        </View>
        {job.referral && (
          <View style={styles.referralBadge}><Text style={styles.referralText}>Referral</Text></View>
        )}
      </View>

      {!!job.skills?.length && (
        <View style={styles.tagsRow}>
          {job.skills.slice(0, 4).map((s) => (
            <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>
          ))}
        </View>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.postedBy}>Posted by {job.posted_by?.name || "Someone"}</Text>
        {job.apply_link ? (
          <TouchableOpacity style={styles.applyBtn} onPress={() => Linking.openURL(job.apply_link!)}>
            <Text style={styles.applyText}>Apply ↗</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.applyBtnMuted}>
            <Text style={styles.applyTextMuted}>Contact poster</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink3, borderRadius: radius.md, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderDark,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  title: { color: colors.textOnDark, fontWeight: "600", fontSize: 15 },
  company: { color: colors.textOnDark2, fontSize: 12.5, marginTop: 2 },
  referralBadge: { backgroundColor: "rgba(180,83,9,0.2)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  referralText: { color: colors.gold, fontSize: 10.5, fontWeight: "600" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  tag: { backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagText: { color: colors.textOnDark2, fontSize: 11 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  postedBy: { color: colors.textOnDark3, fontSize: 11.5 },
  applyBtn: { backgroundColor: colors.purple, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  applyText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  applyBtnMuted: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  applyTextMuted: { color: colors.textOnDark2, fontSize: 12, fontWeight: "600" },
});
