/**
 * localStorage → Supabase 评论迁移工具
 *
 * 使用方式（在浏览器控制台或开发环境页面中调用）：
 *   1. 确保已登录 Supabase
 *   2. await migrateCommentsToSupabase()
 */

import { supabase } from "./supabase";

const OLD_STORAGE_KEY = "usedchang-comments";

/**
 * 读取 localStorage 中的旧评论
 */
function readOldComments() {
  try {
    const raw = localStorage.getItem(OLD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 将旧评论迁移到 Supabase
 * @param {string} userId - 当前登录用户的 Supabase UUID
 * @returns {Promise<{ migrated: number; skipped: number; errors: string[] }>}
 */
export async function migrateComments(userId) {
  const old = readOldComments();
  if (old.length === 0) {
    return { migrated: 0, skipped: 0, errors: ["本地没有旧评论数据"] };
  }

  let migrated = 0;
  let skipped = 0;
  const errors = [];

  for (const comment of old) {
    try {
      // 插入顶级评论（无 parent_id）
      const { data: parent, error: parentErr } = await supabase
        .from("comments")
        .insert({
          post_id: comment.postId,
          user_id: userId,
          content: comment.content || "(无内容)",
          created_at: new Date(comment.createdAt || Date.now()).toISOString(),
          is_deleted: false,
        })
        .select("id")
        .single();

      if (parentErr) {
        errors.push(`评论 ${comment.id}: ${parentErr.message}`);
        skipped++;
        continue;
      }

      migrated++;

      // 迁移回复
      if (comment.replies && Array.isArray(comment.replies)) {
        for (const reply of comment.replies) {
          try {
            const { error: replyErr } = await supabase.from("comments").insert({
              post_id: comment.postId,
              user_id: userId,
              parent_id: parent.id,
              content: reply.content || "(无内容)",
              created_at: new Date(reply.createdAt || Date.now()).toISOString(),
              is_deleted: false,
            });

            if (replyErr) {
              errors.push(`回复 ${reply.id}: ${replyErr.message}`);
            } else {
              migrated++;
            }
          } catch (e) {
            errors.push(`回复 ${reply.id}: ${e.message}`);
          }
        }
      }
    } catch (e) {
      errors.push(`评论 ${comment.id}: ${e.message}`);
      skipped++;
    }
  }

  return { migrated, skipped, errors };
}

/**
 * 清空 localStorage 中的旧评论（迁移完成后调用）
 */
export function clearOldComments() {
  localStorage.removeItem(OLD_STORAGE_KEY);
}

/**
 * 获取旧评论统计信息
 */
export function getOldCommentStats() {
  const old = readOldComments();
  let totalReplies = 0;
  for (const c of old) {
    totalReplies += c.replies?.length || 0;
  }
  return {
    topLevel: old.length,
    replies: totalReplies,
    total: old.length + totalReplies,
  };
}
