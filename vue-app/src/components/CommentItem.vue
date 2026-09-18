<script setup>
import { ref } from "vue";
import { useAuth } from "../composables/useAuth";
import { usePermission } from "../composables/usePermission";
import { addReply, deleteComment, MAX_COMMENT_LENGTH } from "../composables/useComments";

const props = defineProps({
  comment: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  postId: { type: String, required: true },
});

const emit = defineEmits(["needLogin", "changed"]);

const { user } = useAuth();
const { isAdmin } = usePermission();

const replyOpen = ref(false);
const replyContent = ref("");
const submitting = ref(false);
const deleting = ref(false);
const error = ref("");

const maxDepth = 3;

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function getAuthorName(comment) {
  if (comment.is_deleted) return "已删除";
  return comment.profiles?.username || "匿名用户";
}

function getInitial(comment) {
  return (getAuthorName(comment) || "?")[0];
}

function isOwn(comment) {
  return user.value && user.value.id === comment.user_id;
}

function canDelete(comment) {
  return !comment.is_deleted && (isAdmin.value || isOwn(comment));
}

function toggleReply() {
  replyOpen.value = !replyOpen.value;
  replyContent.value = "";
  error.value = "";
}

async function handleReply() {
  if (!replyContent.value.trim() || submitting.value) return;
  if (!user.value) {
    emit("needLogin");
    return;
  }
  submitting.value = true;
  error.value = "";
  try {
    await addReply(props.postId, user.value.id, props.comment.id, replyContent.value.trim());
    replyOpen.value = false;
    replyContent.value = "";
    // Realtime 不可用时也能立即看到新回复。
    emit("changed");
  } catch (e) {
    error.value = e.message || "回复失败";
  } finally {
    submitting.value = false;
  }
}

async function handleDelete() {
  if (deleting.value) return;
  if (!confirm("确定要删除这条评论吗？")) return;
  deleting.value = true;
  error.value = "";
  try {
    await deleteComment(props.comment.id);
    emit("changed");
  } catch (e) {
    error.value = e.message || "删除失败";
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="comment-item" :class="{ 'comment-nested': depth > 0 }">
    <div class="comment-avatar">{{ getInitial(comment) }}</div>
    <div class="comment-body">
      <div class="comment-header">
        <span class="comment-author">{{ getAuthorName(comment) }}</span>
        <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
      </div>
      <div class="comment-content" :class="{ 'comment-content-deleted': comment.is_deleted }">
        {{ comment.is_deleted ? "该评论已删除" : comment.content }}
      </div>
      <div class="comment-actions">
        <button
          v-if="!comment.is_deleted && depth < maxDepth"
          class="comment-action-btn"
          @click="toggleReply"
        >
          {{ replyOpen ? "取消回复" : "回复" }}
        </button>
        <button
          v-if="canDelete(comment)"
          class="comment-action-btn comment-action-danger"
          :disabled="deleting"
          @click="handleDelete"
        >
          {{ deleting ? "删除中..." : "删除" }}
        </button>
      </div>

      <p v-if="error" class="auth-error">{{ error }}</p>

      <!-- 内联回复表单 -->
      <div v-if="replyOpen" class="reply-form">
        <textarea
          v-model="replyContent"
          class="form-textarea"
          rows="2"
          :maxlength="MAX_COMMENT_LENGTH"
          placeholder="写下您的回复..."
          :disabled="submitting"
        ></textarea>
        <button
          class="btn btn-primary btn-sm"
          :disabled="!replyContent.trim() || submitting"
          @click="handleReply"
        >
          {{ submitting ? "回复中..." : "回复" }}
        </button>
      </div>

      <!-- 递归渲染子回复 -->
      <div v-if="comment.replies && comment.replies.length > 0" class="reply-list">
        <CommentItem
          v-for="reply in comment.replies"
          :key="reply.id"
          :comment="reply"
          :depth="depth + 1"
          :postId="postId"
          @need-login="emit('needLogin')"
          @changed="emit('changed')"
        />
      </div>
    </div>
  </div>
</template>
