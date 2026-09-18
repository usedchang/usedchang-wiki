import { ref } from "vue";
import { supabase, supabaseConfigured } from "../utils/supabase";

export const MAX_COMMENT_LENGTH = 5000;
const MAX_REPLY_DEPTH = 3;

function ensureConfigured() {
  if (!supabaseConfigured) {
    throw new Error("评论服务尚未配置，请联系站长");
  }
}

function validateContent(content) {
  const value = String(content || "").trim();
  if (!value) throw new Error("评论内容不能为空");
  if (value.length > MAX_COMMENT_LENGTH) {
    throw new Error(`评论不能超过 ${MAX_COMMENT_LENGTH} 个字符`);
  }
  return value;
}

/**
 * 读取评论并单独加载 profile。
 * 不依赖 Supabase 自动推断外键名称，避免 schema cache 或迁移顺序导致的 PGRST 错误。
 */
async function fetchComments(postId) {
  ensureConfigured();
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = data || [];
  const userIds = [...new Set(rows.map((comment) => comment.user_id).filter(Boolean))];
  if (!userIds.length) return nestComments(rows);

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", userIds);
  if (profileError) {
    // 评论正文仍可展示，profile 权限/缓存异常不应让整个评论区失效。
    console.warn("加载评论用户资料失败：", profileError.message);
    return nestComments(rows);
  }
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return nestComments(
    rows.map((comment) => ({ ...comment, profiles: profileMap.get(comment.user_id) || null }))
  );
}

/** 发表顶级评论 */
async function addComment(postId, userId, content) {
  ensureConfigured();
  const value = validateContent(content);
  if (!userId) throw new Error("请先登录后再发表评论");
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: userId, content: value })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** 回复评论 */
async function addReply(postId, userId, parentId, content) {
  ensureConfigured();
  const value = validateContent(content);
  if (!userId) throw new Error("请先登录后再回复");
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: userId, parent_id: parentId, content: value })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** 软删除评论 */
async function deleteComment(commentId) {
  ensureConfigured();
  const { error } = await supabase.rpc("soft_delete_comment", {
    target_comment_id: commentId,
  });
  if (error) throw error;
}

/** 将扁平评论列表嵌套为树（顶级评论包含 replies 数组） */
function nestComments(flat) {
  const map = new Map();
  const rows = new Map();
  const roots = [];
  for (const comment of flat) {
    rows.set(comment.id, comment);
    map.set(comment.id, { ...comment, replies: [] });
  }
  for (const comment of flat) {
    const node = map.get(comment.id);
    if (!node) continue;
    let parentId = comment.parent_id;
    let depth = 0;
    let validChain = true;
    const seen = new Set([comment.id]);
    while (parentId) {
      if (seen.has(parentId) || !rows.has(parentId) || depth >= MAX_REPLY_DEPTH) {
        validChain = false;
        break;
      }
      seen.add(parentId);
      depth += 1;
      parentId = rows.get(parentId).parent_id;
    }
    if (validChain && comment.parent_id) map.get(comment.parent_id).replies.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * 评论 composable。
 * Realtime 只负责触发刷新，实际列表仍从数据库读取，保证嵌套回复和 profile 一致。
 */
export function useComments(postId) {
  const comments = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const available = ref(supabaseConfigured);
  const realtimeStatus = ref(supabaseConfigured ? "idle" : "disabled");
  let channel = null;
  let reloadTimer = null;
  let retryTimer = null;
  let active = false;
  let requestId = 0;

  async function load() {
    if (!supabaseConfigured || !postId) {
      comments.value = [];
      loading.value = false;
      return;
    }
    const currentRequest = ++requestId;
    loading.value = true;
    error.value = null;
    try {
      const next = await fetchComments(postId);
      if (currentRequest === requestId) comments.value = next;
    } catch (e) {
      if (currentRequest === requestId) {
        error.value = e?.message || "加载评论失败";
        comments.value = [];
      }
    } finally {
      if (currentRequest === requestId) loading.value = false;
    }
  }

  function scheduleLoad() {
    if (reloadTimer) window.clearTimeout(reloadTimer);
    reloadTimer = window.setTimeout(() => {
      reloadTimer = null;
      load();
    }, 80);
  }

  function subscribe() {
    if (!supabaseConfigured || !postId || channel) return;
    active = true;
    realtimeStatus.value = "connecting";
    channel = supabase
      .channel(`comments:${encodeURIComponent(postId)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        () => scheduleLoad()
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") realtimeStatus.value = "connected";
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          realtimeStatus.value = "error";
          const failedChannel = channel;
          channel = null;
          if (failedChannel) supabase.removeChannel(failedChannel);
          if (active && !retryTimer) {
            retryTimer = window.setTimeout(() => {
              retryTimer = null;
              subscribe();
            }, 3000);
          }
        }
        else realtimeStatus.value = "connecting";
      });
  }

  function unsubscribe() {
    active = false;
    if (reloadTimer) {
      window.clearTimeout(reloadTimer);
      reloadTimer = null;
    }
    if (retryTimer) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    if (supabaseConfigured) realtimeStatus.value = "idle";
  }

  return { comments, loading, error, available, realtimeStatus, load, subscribe, unsubscribe };
}

export { addComment, addReply, deleteComment };
