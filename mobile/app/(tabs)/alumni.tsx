// app/(tabs)/alumni.tsx
import React, { useCallback, useState } from "react";
import { View, Text, FlatList, TextInput, StyleSheet, ActivityIndicator, SafeAreaView, Alert } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { UsersAPI, ChatAPI } from "../../constants/api";
import AlumniCard, { AlumniUser } from "../../components/AlumniCard";
import EmptyState from "../../components/EmptyState";
import { colors, radius, spacing } from "../../constants/theme";

export default function AlumniScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<AlumniUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  let debounceTimer: any = null;

  const load = useCallback(async (q: string = "") => {
    setLoading(true);
    try {
      const data = await UsersAPI.list(q ? { q } : {});
      setUsers(data || []);
    } catch {
      // silent — keep previous list rather than clearing it
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

  const handleMessage = async (roll: string) => {
    try {
      const room: any = await ChatAPI.startDM(roll);
      router.push(`/chat/${room.id}`);
    } catch (e: any) {
      Alert.alert("Couldn't start chat", e.message);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alumni & Students</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={colors.textOnDark3} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, roll, branch, skills…"
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
          data={users}
          keyExtractor={(item) => item.roll_number}
          contentContainerStyle={{ padding: spacing.lg }}
          ListEmptyComponent={<EmptyState text="No one found. Try a different search." dark />}
          renderItem={({ item }) => (
            <AlumniCard
              user={item}
              onView={(roll) => router.push(`/profile/${roll}`)}
              onMessage={handleMessage}
            />
          )}
        />
      )}
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
});
