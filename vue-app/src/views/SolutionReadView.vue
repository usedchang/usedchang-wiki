<script setup>
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import MarkdownIt from "markdown-it";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItFootnote from "markdown-it-footnote";
import markdownItDeflist from "markdown-it-deflist";
import markdownItMark from "markdown-it-mark";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import markdownItTexmath from "markdown-it-texmath";
import katex from "katex";
import DOMPurify from "dompurify";
import { getPostById } from "../utils/postStorage";
import "katex/dist/katex.min.css";

const route = useRoute();
const post = ref(null);

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

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  typographer: true,
})
  .use(markdownItTaskLists, { enabled: true })
  .use(markdownItFootnote)
  .use(markdownItDeflist)
  .use(markdownItMark)
  .use(markdownItSub)
  .use(markdownItSup)
  .use(markdownItTexmath, {
    engine: katex,
    delimiters: "dollars",
    katexOptions: { throwOnError: false },
  });

const renderedHtml = computed(() => {
  if (!post.value?.content) return "";
  return DOMPurify.sanitize(md.render(post.value.content));
});
</script>

<template>
  <main class="container section read-page">
    <section v-if="post" class="panel read-panel">
      <header class="read-head">
        <h1>{{ post.title || "未命名题解" }}</h1>
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
      <article class="markdown-preview" v-html="renderedHtml"></article>
    </section>

    <section v-else class="empty-state">
      文章不存在或已被删除。
    </section>
  </main>
</template>
