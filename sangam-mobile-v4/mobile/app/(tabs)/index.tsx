// app/(tabs)/index.tsx
import React, { useCallback, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Modal, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator, Alert, SafeAreaView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PostsAPI } from "../../constants/api";
import { useAuth } from "../../hooks/useAuth";
import PostCard, { Post } from "../../components/PostCard";
import EmptyState from "../../components/EmptyState";
import { colors, radius, spacing } from "../../constants/theme";

export default function FeedScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await PostsAPI.list();
      setPosts(data || []);
    } catch {
      // keep whatever was already loaded; feed just won't refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleLike = async (id: string) => {
    setPosts((prev) => prev.map((p) => p.id === id
      ? { ...p, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) }
      : p));
    try { await PostsAPI.like(id); } catch { load(); }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete post?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        try { await PostsAPI.remove(id); } catch { load(); }
      }},
    ]);
  };

  const submitPost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      await PostsAPI.create({ post_type: "update", content: content.trim() });
      setContent("");
      setModalOpen(false);
      load();
    } catch (e: any) {
      Alert.alert("Couldn't post", e.message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.purple} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
          ListEmptyComponent={<EmptyState text="No posts yet — be the first to share something!" dark />}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={handleLike}
              onDelete={handleDelete}
              isMine={item.author?.roll_number === user?.roll_number}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalOpen(true)}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Post</Text>
            <TextInput
              style={styles.textArea}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.textOnDark3}
              multiline
              value={content}
              onChangeText={setContent}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.postBtn, posting && { opacity: 0.6 }]} disabled={posting} onPress={submitPost}>
                {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.postText}>Post</Text>}
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
  headerTitle: { color: colors.textOnDark, fontSize: 22, fontWeight: "700" },
  fab: {
    position: "absolute", right: 20, bottom: 24, width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.purple, alignItems: "center", justifyContent: "center",
    shadowColor: colors.purple, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.ink2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl },
  modalTitle: { color: colors.textOnDark, fontSize: 17, fontWeight: "700", marginBottom: spacing.md },
  textArea: {
    backgroundColor: colors.ink3, borderRadius: radius.md, padding: spacing.md, color: colors.textOnDark,
    minHeight: 100, textAlignVertical: "top", fontSize: 14, borderWidth: 1, borderColor: colors.borderDark,
  },
  modalRow: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.06)" },
  cancelText: { color: colors.textOnDark2, fontWeight: "600" },
  postBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.purple },
  postText: { color: "#fff", fontWeight: "600" },
});
