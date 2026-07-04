<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useComments, addComment } from "../composables/useComments";
import { useAuth } from "../composables/useAuth";
import CommentItem from "./CommentItem.vue";

const props = defineProps({
  postId: { type: String, required: true },
});

const emit = defineEmits(["needLogin"]);

const { user } = useAuth();
const { comments, loading, error, load, subscribe, unsubscribe } = useComments(props.postId);

const content = ref("");
const submitting = ref(false);
const submitError = ref("");

async function handleSubmit() {
  if (!content.value.trim() || submitting.value) return;
  if (!user.value) {
    emit("needLogin");
    return;
  }
  submitting.value = true;
  submitError.value = "";
  try {
    await addComment(props.postId, user.value.id, content.value.trim());
    content.value = "";
  } catch (e) {
    submitError.value = e.message || "发表失败";
  } finally {
    submitting.value = false;
  }
}

// 子评论变更时重新加载
function onCommentChanged() {
  load();
}

onMounted(() => {
  load();
  subscribe();
});

onUnmounted(() => {
  unsubscribe();
});
</script>

<template>
  <section class="comment-section">
    <h2>评论区</h2>

    <!-- 发表评论 -->
    <div class="comment-form">
      <div v-if="!user" class="comment-login-hint">
        <button class="btn btn-ghost" @click="emit('needLogin')">登录</button>
        后即可发表评论
      </div>
      <template v-else>
        <textarea
          v-model="content"
          class="form-textarea"
          rows="3"
          placeholder="写下您的评论..."
          :disabled="submitting"
        ></textarea>
        <p v-if="submitError" class="auth-error">{{ submitError }}</p>
        <button
          class="btn btn-primary"
          :disabled="!content.trim() || submitting"
          @click="handleSubmit"
        >
          {{ submitting ? "发表中..." : "发表评论" }}
        </button>
      </template>
    </div>

    <!-- 状态 -->
    <p v-if="loading" class="comment-status">加载评论中...</p>
    <p v-else-if="error" class="auth-error">加载失败：{{ error }}</p>

    <template v-else>
      <h3>评论 ({{ comments.length }})</h3>

      <div v-if="comments.length === 0" class="empty-state">
        还没有评论，快来发表第一条评论吧！
      </div>

      <div v-else class="comment-list">
        <CommentItem
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          :depth="0"
          :postId="postId"
          @need-login="emit('needLogin')"
          @deleted="onCommentChanged"
        />
      </div>
    </template>
  </section>
</template>
