<script setup>
import { computed, ref, watch, onMounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import DOMPurify from "dompurify";
import { getPostById, POST_KIND } from "../utils/postStorage";
import { createMarkdownIt, attachCopyButtons } from "../utils/markdownRenderer";
import CommentSection from "../components/CommentSection.vue";
import { useAuth } from "../composables/useAuth";
import { SITE_TITLE } from "../constants";
import "katex/dist/katex.min.css";

const route = useRoute();
const post = ref(null);
const markdownPreview = ref(null);
const { openAuthModal } = useAuth();

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
      <CommentSection :postId="post.id" @need-login="openAuthModal" />
    </section>
  </main>
</template>
