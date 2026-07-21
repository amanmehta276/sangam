// app/(tabs)/profile.tsx
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UsersAPI } from "../../constants/api";
import { useAuth } from "../../hooks/useAuth";
import Avatar from "../../components/Avatar";
import { colors, radius, spacing } from "../../constants/theme";

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || "");
  const [skillsText, setSkillsText] = useState((user?.skills || []).join(", "));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const skills = skillsText.split(",").map((s) => s.trim()).filter(Boolean);
      const updated = await UsersAPI.updateMe({ bio, skills });
      await updateUser(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert("Log out?", "You'll need to verify your roll number again to log back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.headerRow}>
          <Avatar name={user?.name} avatarUrl={user?.avatar_url} size={72} />
          <View style={{ marginLeft: spacing.lg, flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.meta}>{user?.roll_number}</Text>
            <Text style={styles.meta}>{user?.branch} · Batch {user?.batch_year}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Bio</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Ionicons name="pencil" size={16} color={colors.purple3} />
              </TouchableOpacity>
            )}
          </View>
          {editing ? (
            <>
              <TextInput
                style={styles.textArea}
                placeholder="Tell people about yourself…"
                placeholderTextColor={colors.textOnDark3}
                multiline
                value={bio}
                onChangeText={setBio}
              />
              <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Skills (comma separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="React, Python, DSA…"
                placeholderTextColor={colors.textOnDark3}
                value={skillsText}
                onChangeText={setSkillsText}
              />
              <View style={styles.editRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} disabled={saving} onPress={save}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.bioText}>{user?.bio || "No bio yet — tap the pencil to add one."}</Text>
              {!!user?.skills?.length && (
                <View style={styles.tagsRow}>
                  {user.skills.map((s: string) => (
                    <View key={s} style={styles.tag}><Text style={styles.tagText}>{s}</Text></View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout}>
          <Ionicons name="log-out-outline" size={18} color={colors.red} />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  name: { color: colors.textOnDark, fontSize: 19, fontWeight: "700" },
  meta: { color: colors.textOnDark3, fontSize: 12.5, marginTop: 2 },
  section: {
    backgroundColor: colors.ink3, borderRadius: radius.md, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderDark, marginBottom: spacing.lg,
  },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sectionTitle: { color: colors.textOnDark2, fontSize: 12.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  bioText: { color: colors.textOnDark, fontSize: 14, lineHeight: 20 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  tag: { backgroundColor: "rgba(29,78,216,0.15)", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  tagText: { color: colors.purple3, fontSize: 11.5 },
  textArea: {
    backgroundColor: colors.ink2, borderRadius: radius.sm, padding: spacing.md, color: colors.textOnDark,
    minHeight: 80, textAlignVertical: "top", fontSize: 14, borderWidth: 1, borderColor: colors.borderDark,
  },
  input: {
    backgroundColor: colors.ink2, borderRadius: radius.sm, padding: spacing.md, color: colors.textOnDark,
    fontSize: 14, borderWidth: 1, borderColor: colors.borderDark, marginTop: spacing.xs,
  },
  editRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.06)" },
  cancelText: { color: colors.textOnDark2, fontWeight: "600" },
  saveBtn: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: radius.sm, backgroundColor: colors.purple },
  saveText: { color: "#fff", fontWeight: "600" },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(220,38,38,0.35)",
  },
  logoutText: { color: colors.red, fontWeight: "600", fontSize: 14 },
});
