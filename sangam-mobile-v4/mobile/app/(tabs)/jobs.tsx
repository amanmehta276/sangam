// app/(tabs)/jobs.tsx
import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, SafeAreaView, Alert, Switch,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { JobsAPI } from "../../constants/api";
import { useAuth } from "../../hooks/useAuth";
import JobCard, { Job } from "../../components/JobCard";
import EmptyState from "../../components/EmptyState";
import { colors, radius, spacing } from "../../constants/theme";

const CAN_POST_ROLES = ["alumni", "teacher", "admin"];

export default function JobsScreen() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  let debounceTimer: any = null;

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [applyLink, setApplyLink] = useState("");
  const [referral, setReferral] = useState(false);

  const load = useCallback(async (q: string = "") => {
    setLoading(true);
    try {
      const data = await JobsAPI.list(q ? { q } : {});
      setJobs(data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onSearchChange = (text: string) => {
    setQuery(text);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => load(text), 300);
  };

  const canPost = user?.role && CAN_POST_ROLES.includes(user.role);

  const submitJob = async () => {
    if (!title.trim() || !company.trim()) {
      Alert.alert("Missing info", "Title and company are required.");
      return;
    }
    setPosting(true);
    try {
      await JobsAPI.create({
        title: title.trim(), company: company.trim(), location: location.trim(),
        apply_link: applyLink.trim(), referral,
      });
      setTitle(""); setCompany(""); setLocation(""); setApplyLink(""); setReferral(false);
      setModalOpen(false);
      load();
    } catch (e: any) {
      Alert.alert("Couldn't post job", e.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textOnDark3} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title, company, location, skills…"
            placeholderTextColor={colors.textOnDark3}
            value={query}
            onChangeText={onSearchChange}
          />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.purple} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<EmptyState text="No jobs posted yet." dark />}
          renderItem={({ item }) => <JobCard job={item} />}
        />
      )}

      {canPost && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Post a Job</Text>
            <TextInput style={styles.input} placeholder="Job title" placeholderTextColor={colors.textOnDark3} value={title} onChangeText={setTitle} />
            <TextInput style={styles.input} placeholder="Company" placeholderTextColor={colors.textOnDark3} value={company} onChangeText={setCompany} />
            <TextInput style={styles.input} placeholder="Location (optional)" placeholderTextColor={colors.textOnDark3} value={location} onChangeText={setLocation} />
            <TextInput style={styles.input} placeholder="Apply link (optional)" placeholderTextColor={colors.textOnDark3} value={applyLink} onChangeText={setApplyLink} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>This is a referral</Text>
              <Switch value={referral} onValueChange={setReferral} trackColor={{ true: colors.purple }} />
            </View>
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.postBtn, posting && { opacity: 0.6 }]} disabled={posting} onPress={submitJob}>
                {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.postText}>Post Job</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerTitle: { color: colors.textOnDark, fontSize: 22, fontWeight: "700", marginBottom: spacing.md },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.ink3, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: colors.borderDark,
  },
  searchInput: { flex: 1, color: colors.textOnDark, fontSize: 13.5 },
  fab: {
    position: "absolute", right: 20, bottom: 24, width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.purple, alignItems: "center", justifyContent: "center",
    shadowColor: colors.purple, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.ink2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl },
  modalTitle: { color: colors.textOnDark, fontSize: 17, fontWeight: "700", marginBottom: spacing.md },
  input: {
    backgroundColor: colors.ink3, borderRadius: radius.md, padding: spacing.md, color: colors.textOnDark,
    fontSize: 14, borderWidth: 1, borderColor: colors.borderDark, marginBottom: spacing.sm,
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  switchLabel: { color: colors.textOnDark2, fontSize: 13.5 },
  modalRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.06)" },
  cancelText: { color: colors.textOnDark2, fontWeight: "600" },
  postBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.purple },
  postText: { color: "#fff", fontWeight: "600" },
});
