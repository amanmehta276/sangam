// components/PostCard.tsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "./Avatar";
import { colors, radius, spacing } from "../constants/theme";

export type Post = {
  id: string;
  author: { name: string; roll_number: string; avatar_url?: string; role?: string };
  content: string;
  post_type: string;
  tags?: string[];
  likes_count: number;
  liked_by_me?: boolean;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function PostCard({ post, onLike, onDelete, isMine }: {
  post: Post;
  onLike: (id: string) => void;
  onDelete?: (id: string) => void;
  isMine?: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar name={post.author?.name} avatarUrl={post.author?.avatar_url} size={38} />
        <View style={{ marginLeft: spacing.sm, flex: 1 }}>
          <Text style={styles.name}>{post.author?.name}</Text>
          <Text style={styles.meta}>{post.author?.role} · {timeAgo(post.created_at)}</Text>
        </View>
        {isMine && onDelete && (
          <TouchableOpacity onPress={() => onDelete(post.id)}>
            <Ionicons name="trash-outline" size={18} color={colors.textOnDark3} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.content}>{post.content}</Text>

      {!!post.tags?.length && (
        <View style={styles.tagsRow}>
          {post.tags.map((t) => (
            <View key={t} style={styles.tag}><Text style={styles.tagText}>#{t}</Text></View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.likeRow} onPress={() => onLike(post.id)}>
        <Ionicons
          name={post.liked_by_me ? "heart" : "heart-outline"}
          size={18}
          color={post.liked_by_me ? colors.red : colors.textOnDark2}
        />
        <Text style={styles.likeCount}>{post.likes_count || 0}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink3,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDark,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  name: { color: colors.textOnDark, fontWeight: "600", fontSize: 14 },
  meta: { color: colors.textOnDark3, fontSize: 11.5, marginTop: 1 },
  content: { color: colors.textOnDark, fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm },
  tag: { backgroundColor: "rgba(29,78,216,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  tagText: { color: colors.purple3, fontSize: 11 },
  likeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  likeCount: { color: colors.textOnDark2, fontSize: 12.5 },
});
