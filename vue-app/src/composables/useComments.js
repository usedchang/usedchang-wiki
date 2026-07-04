import { ref } from "vue";
import { supabase } from "../utils/supabase";

/**
 * 获取某篇文章的所有评论（含回复），并嵌套为树形结构
 */
async function fetchComments(postId) {
  const { data, error } = await supabase
    .from("comments")
    .select("*, profiles(username, avatar_url)")
    .eq("post_id", postId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return nestComments(data || []);
}

/**
 * 发表顶级评论
 */
async function addComment(postId, userId, content) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: userId, content })
    .select("*, profiles(username, avatar_url)")
    .single();

  if (error) throw error;
  return data;
}

/**
 * 回复评论
 */
async function addReply(postId, userId, parentId, content) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: userId, parent_id: parentId, content })
    .select("*, profiles(username, avatar_url)")
    .single();

  if (error) throw error;
  return data;
}

/**
 * 软删除评论
 */
async function deleteComment(commentId) {
  const { error } = await supabase
    .from("comments")
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq("id", commentId);

  if (error) throw error;
}

/**
 * 将扁平评论列表嵌套为树（顶级评论包含 replies 数组）
 */
function nestComments(flat) {
  const map = new Map();
  const roots = [];

  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] });
  }
  for (const c of flat) {
    const node = map.get(c.id);
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * 评论 composable（每次调用创建独立 channel，组件卸载时需手动清理）
 */
export function useComments(postId) {
  const comments = ref([]);
  const loading = ref(false);
  const error = ref(null);
  let channel = null;

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      comments.value = await fetchComments(postId);
    } catch (e) {
      error.value = e.message;
      comments.value = [];
    } finally {
      loading.value = false;
    }
  }

  function subscribe() {
    if (!postId) return;
    channel = supabase
      .channel(`comments:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        () => {
          // 任何变更都重新拉取（保持嵌套结构正确）
          load();
        }
      )
      .subscribe();
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  }

  return {
    comments,
    loading,
    error,
    load,
    subscribe,
    unsubscribe,
  };
}

export { addComment, addReply, deleteComment };
