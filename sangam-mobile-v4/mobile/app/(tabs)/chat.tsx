// app/(tabs)/chat.tsx
import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Modal, StyleSheet,
  ActivityIndicator, SafeAreaView, Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChatAPI } from "../../constants/api";
import Avatar from "../../components/Avatar";
import EmptyState from "../../components/EmptyState";
import { colors, radius, spacing } from "../../constants/theme";

type Room = {
  id: string; type: string; name?: string;
  dm_with?: { roll_number: string; name: string; avatar_url?: string };
  last_message?: { content: string };
};

export default function ChatScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState<{ system_groups: Room[]; my_groups: Room[]; dms: Room[] }>({ system_groups: [], my_groups: [], dms: [] });
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  let debounceTimer: any = null;

  const load = useCallback(async () => {
    try {
      const data = await ChatAPI.rooms();
      setRooms(data);
    } catch {
      // silent — keep whatever loaded before
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const allRooms = [...rooms.system_groups, ...rooms.my_groups, ...rooms.dms];

  const onSearchChange = (text: string) => {
    setSearchQuery(text);
    clearTimeout(debounceTimer);
    if (!text.trim()) { setSearchResults([]); return; }
    debounceTimer = setTimeout(async () => {
      try { setSearchResults(await ChatAPI.searchUsers(text)); } catch { setSearchResults([]); }
    }, 300);
  };

  const startDM = async (roll: string) => {
    try {
      const room: any = await ChatAPI.startDM(roll);
      setSearchOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      router.push(`/chat/${room.id}`);
    } catch (e: any) {
      Alert.alert("Couldn't start chat", e.message);
    }
  };

  const renderRoom = (room: Room) => {
    const isDm = room.type === "dm";
    const name = isDm ? (room.dm_with?.name || room.dm_with?.roll_number || "Unknown") : (room.name || "Group");
    const preview = room.last_message?.content || (room.type === "system" ? "Say hello 👋" : "No messages yet");
    return (
      <TouchableOpacity key={room.id} style={styles.roomItem} onPress={() => router.push(`/chat/${room.id}`)}>
        <Avatar name={name} avatarUrl={isDm ? room.dm_with?.avatar_url : undefined} size={44} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.roomName} numberOfLines={1}>{name}</Text>
          <Text style={styles.roomPreview} numberOfLines={1}>{preview}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => setSearchOpen(true)}>
          <Ionicons name="add-circle-outline" size={22} color={colors.purple3} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.purple} />
      ) : (
        <FlatList
          data={allRooms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          ListEmptyComponent={<EmptyState text="No conversations yet." dark />}
          renderItem={({ item }) => renderRoom(item)}
        />
      )}

      <Modal visible={searchOpen} animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>New Message</Text>
            <TouchableOpacity onPress={() => setSearchOpen(false)}>
              <Ionicons name="close" size={24} color={colors.textOnDark2} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.textOnDark3} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or roll number…"
              placeholderTextColor={colors.textOnDark3}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
            />
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.roll_number}
            contentContainerStyle={{ padding: spacing.lg }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.roomItem} onPress={() => startDM(item.roll_number)}>
                <Avatar name={item.name} avatarUrl={item.avatar_url} size={42} />
                <View style={{ marginLeft: spacing.md }}>
                  <Text style={styles.roomName}>{item.name}</Text>
                  <Text style={styles.roomPreview}>{item.roll_number} · {item.branch}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerTitle: { color: colors.textOnDark, fontSize: 22, fontWeight: "700" },
  newBtn: { padding: 4 },
  roomItem: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)",
  },
  roomName: { color: colors.textOnDark, fontSize: 14, fontWeight: "600" },
  roomPreview: { color: colors.textOnDark3, fontSize: 12.5, marginTop: 2 },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.ink3, borderRadius: radius.md,
    marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: 10, gap: 8,
    borderWidth: 1, borderColor: colors.borderDark,
  },
  searchInput: { flex: 1, color: colors.textOnDark, fontSize: 13.5 },
});
