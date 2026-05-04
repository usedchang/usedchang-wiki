<script setup>
import { computed, ref, watch, onMounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import DOMPurify from "dompurify";
import { getPostById, POST_KIND } from "../utils/postStorage";
import { getCommentsByPostId, createComment, addReply, likeComment, deleteComment } from "../utils/commentStorage";
import { createMarkdownIt, attachCopyButtons } from "../utils/markdownRenderer";
import { SITE_TITLE } from "../constants";
import "katex/dist/katex.min.css";

const route = useRoute();
const post = ref(null);
const comments = ref([]);
const commentContent = ref("");
const authorName = ref("");
const replyTo = ref(null);
const replyContent = ref("");
const markdownPreview = ref(null);

const md = createMarkdownIt();

function formatTime(ts) {
  if (!ts) return "未知时间";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function loadPost(id) {
  if (typeof id !== "string" || !id) {
    post.value = null;
    return;
  }
  post.value = getPostById(id);
  loadComments(id);
}

function loadComments(postId) {
  comments.value = getCommentsByPostId(postId);
}

function submitComment() {
  if (!commentContent.value.trim()) return;
  const author = authorName.value.trim() || "匿名用户";
  createComment(post.value.id, commentContent.value.trim(), author);
  commentContent.value = "";
  authorName.value = "";
  loadComments(post.value.id);
}

function submitReply() {
  if (!replyContent.value.trim() || !replyTo.value) return;
  const author = authorName.value.trim() || "匿名用户";
  addReply(replyTo.value, replyContent.value.trim(), author);
  replyContent.value = "";
  replyTo.value = null;
  loadComments(post.value.id);
}

function handleLike(commentId) {
  likeComment(commentId);
  loadComments(post.value.id);
}

function handleDelete(commentId) {
  if (confirm("确定要删除这条评论吗？")) {
    deleteComment(commentId);
    loadComments(post.value.id);
  }
}

function startReply(commentId) {
  replyTo.value = commentId;
  nextTick(() => {
    document.getElementById("reply-input")?.focus();
  });
}

watch(
  () => route.params.id,
  (id) => loadPost(id),
  { immediate: true }
);

const renderedHtml = computed(() => {
  if (!post.value?.content) return "";
  return DOMPurify.sanitize(md.render(post.value.content));
});

function bindCopyButtons() {
  nextTick(() => {
    const root = markdownPreview.value;
    if (root) attachCopyButtons(root);
  });
}

watch(() => post.value?.content, bindCopyButtons);
watch(renderedHtml, bindCopyButtons);

onMounted(() => {
  bindCopyButtons();
});

const readKindLabel = computed(() => {
  if (!post.value) return "";
  return post.value.kind === POST_KIND.journal ? "游记" : "题解";
});

const defaultTitle = computed(() => {
  if (!post.value) return "";
  return post.value.kind === POST_KIND.journal ? "未命名游记" : "未命名题解";
});

watch(
  () => [post.value?.id, post.value?.title, defaultTitle.value],
  () => {
    const p = post.value;
    if (!p) return;
    const head = (p.title || "").trim() || defaultTitle.value;
    document.title = `${head} · ${SITE_TITLE}`;
  },
  { immediate: true }
);
</script>

<template>
  <main class="container section read-page">
    <section v-if="post" class="panel read-panel">
      <header class="read-head">
        <p v-if="readKindLabel" class="read-kind-badge">{{ readKindLabel }}</p>
        <h1>{{ post.title || defaultTitle }}</h1>
        <p v-if="post.summary" class="read-summary">{{ post.summary }}</p>
        <div class="read-meta">
          <span>状态：{{ post.status === "published" ? "已发布" : "草稿" }}</span>
          <span>发布时间：{{ formatTime(post.publishedAt) }}</span>
          <span>更新时间：{{ formatTime(post.updatedAt) }}</span>
        </div>
        <div v-if="post.tags?.length" class="tag-list read-tags">
          <span v-for="tag in post.tags" :key="tag">{{ tag }}</span>
        </div>
      </header>
      <article ref="markdownPreview" class="markdown-preview" v-html="renderedHtml"></article>
    </section>

    <section v-else class="empty-state">文章不存在或已被删除。</section>

    <section v-if="post" class="panel comment-panel">
      <h2>评论区</h2>

      <div class="comment-form">
        <div class="form-group">
          <label for="author">昵称（可选）</label>
          <input
            id="author"
            v-model="authorName"
            type="text"
            placeholder="请输入您的昵称"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="comment">评论内容</label>
          <textarea
            id="comment"
            v-model="commentContent"
            placeholder="写下您的评论..."
            rows="4"
            class="form-textarea"
          ></textarea>
        </div>
        <button
          class="btn btn-primary"
          :disabled="!commentContent.trim()"
          @click="submitComment"
        >
          发表评论
        </button>
      </div>

      <div v-if="replyTo" class="reply-form">
        <h3>回复评论</h3>
        <textarea
          id="reply-input"
          v-model="replyContent"
          placeholder="写下您的回复..."
          rows="3"
          class="form-textarea"
        ></textarea>
        <div class="reply-actions">
          <button class="btn btn-ghost" @click="replyTo = null; replyContent = ''">取消</button>
          <button class="btn btn-primary" :disabled="!replyContent.trim()" @click="submitReply">
            回复
          </button>
        </div>
      </div>

      <div class="comment-list">
        <h3>评论 ({{ comments.length }})</h3>
        <div v-if="comments.length === 0" class="empty-state">还没有评论，快来发表第一条评论吧！</div>
        <div v-else>
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-author">{{ comment.author }}</span>
              <span class="comment-time">{{ formatTime(comment.createdAt) }}</span>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
            <div class="comment-actions">
              <button class="comment-action-btn" @click="startReply(comment.id)">回复</button>
              <button class="comment-action-btn" @click="handleLike(comment.id)">
                点赞 ({{ comment.likes || 0 }})
              </button>
              <button class="comment-action-btn" @click="handleDelete(comment.id)">删除</button>
            </div>
            <div v-if="comment.replies && comment.replies.length > 0" class="reply-list">
              <div v-for="reply in comment.replies" :key="reply.id" class="reply-item">
                <div class="reply-header">
                  <span class="reply-author">{{ reply.author }}</span>
                  <span class="reply-time">{{ formatTime(reply.createdAt) }}</span>
                </div>
                <div class="reply-content">{{ reply.content }}</div>
                <div class="reply-actions">
                  <button class="comment-action-btn" @click="handleLike(reply.id)">
                    点赞 ({{ reply.likes || 0 }})
                  </button>
                  <button class="comment-action-btn" @click="handleDelete(reply.id)">删除</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
