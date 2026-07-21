// app/profile/[roll].tsx
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { UsersAPI, ChatAPI } from "../../constants/api";
import { useAuth } from "../../hooks/useAuth";
import Avatar from "../../components/Avatar";
import { colors, radius, spacing } from "../../constants/theme";

export default function ViewProfileScreen() {
  const { roll } = useLocalSearchParams<{ roll: string }>();
  const { user: me } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setProfile(await UsersAPI.get(roll)); }
      catch { setProfile(null); }
      finally { setLoading(false); }
    })();
  }, [roll]);

  const message = async () => {
    try {
      const room: any = await ChatAPI.startDM(roll);
      router.replace(`/chat/${room.id}`);
    } catch (e: any) {
      Alert.alert("Couldn't start chat", e.message);
    }
  };

  if (loading) {
    return <View style={styles.screen}><ActivityIndicator style={{ marginTop: 60 }} color={colors.purple} /></View>;
  }

  if (!profile) {
    return (
      <View style={styles.screen}>
        <Text style={styles.notFound}>User not found.</Text>
      </View>
    );
  }

  const isMe = profile.roll_number === me?.roll_number;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={styles.headerRow}>
        <Avatar name={profile.name} avatarUrl={profile.avatar_url} size={80} />
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.meta}>{profile.roll_number}</Text>
        <Text style={styles.meta}>{profile.branch} · Batch {profile.batch_year}</Text>
        {!!profile.company && <Text style={styles.company}>🏢 {profile.company}</Text>}
      </View>

      {!!profile.bio && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>
      )}

      {!!profile.skills?.length && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.tagsRow}>
            {profile.skills.map((s: string) => (
              <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>
            ))}
          </View>
        </View>
      )}

      {!isMe && (
        <TouchableOpacity style={styles.messageBtn} onPress={message}>
          <Text style={styles.messageBtnText}>Message</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  headerRow: { alignItems: "center", marginBottom: spacing.xl },
  name: { color: colors.textOnDark, fontSize: 19, fontWeight: "700", marginTop: spacing.md },
  meta: { color: colors.textOnDark3, fontSize: 12.5, marginTop: 2 },
  company: { color: colors.textOnDark2, fontSize: 12.5, marginTop: 4 },
  section: {
    backgroundColor: colors.ink3, borderRadius: radius.md, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderDark, marginBottom: spacing.lg,
  },
  sectionTitle: { color: colors.textOnDark2, fontSize: 12.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: spacing.sm },
  bioText: { color: colors.textOnDark, fontSize: 14, lineHeight: 20 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { backgroundColor: "rgba(29,78,216,0.15)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  tagText: { color: colors.purple3, fontSize: 11.5 },
  messageBtn: { backgroundColor: colors.purple, borderRadius: radius.md, paddingVertical: 13, alignItems: "center" },
  messageBtnText: { color: "#fff", fontWeight: "600", fontSize: 14.5 },
  notFound: { color: colors.textOnDark2, textAlign: "center", marginTop: 60 },
});
