<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DOMPurify from "dompurify";
import { getAllPosts, getPostById, POST_KIND, POST_LIMITS } from "../utils/postStorage";
import {
  attachCopyButtons,
  copyTextToClipboard,
  createMarkdownIt,
  MARKDOWN_SANITIZE_OPTIONS,
  renderMarkdown,
} from "../utils/markdownRenderer";
import CommentSection from "../components/CommentSection.vue";
import { supabaseConfigured } from "../utils/supabase";
import { pushToast } from "../utils/toast";
import { SITE_TITLE } from "../constants";
import "katex/dist/katex.min.css";

const route = useRoute();
const router = useRouter();
const post = ref(null);
const relatedPosts = ref([]);
const loading = ref(true);
const loadError = ref("");
const markdownPreview = ref(null);
const activeHeadingId = ref("");
const readProgress = ref(0);
const tocOpen = ref(false);
let loadRequest = 0;
let headingObserver = null;
let appliedRouteHash = "";

const md = createMarkdownIt();

function formatDate(ts) {
  if (!ts) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(ts));
}

function readingMinutes(content) {
  const source = String(content || "");
  const proseLength = source.replace(/```[\s\S]*?```/g, " ").replace(/\s+/g, "").length;
  const codeLines = (source.match(/```[\s\S]*?```/g) || [])
    .reduce((sum, block) => sum + block.split(/\r?\n/).length, 0);
  return Math.max(1, Math.ceil(proseLength / 500 + codeLines / 80));
}

async function loadPost(id) {
  const request = ++loadRequest;
  loading.value = true;
  loadError.value = "";
  activeHeadingId.value = "";
  tocOpen.value = false;
  appliedRouteHash = "";
  try {
    const nextPost = await getPostById(id, {
      // Drafts are only readable in the local, unconfigured writing mode.
      // A configured Supabase project must keep unpublished posts behind the
      // admin editor/RLS boundary instead of exposing them through /posts/:id.
      includeDrafts: !supabaseConfigured && import.meta.env.DEV,
    });
    if (request !== loadRequest) return;
    if (String(nextPost?.content || "").length > POST_LIMITS.content) {
      throw new Error("文章正文过大，已停止渲染以保护浏览器性能");
    }
    post.value = nextPost;
    if (!nextPost) {
      relatedPosts.value = [];
      return;
    }
    try {
      const visible = await getAllPosts();
      if (request !== loadRequest) return;
      relatedPosts.value = visible
        .filter((item) => item.id !== nextPost.id && item.kind === nextPost.kind)
        .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
    } catch {
      relatedPosts.value = [];
    }
  } catch (error) {
    if (request === loadRequest) {
      post.value = null;
      relatedPosts.value = [];
      loadError.value = error?.message || "读取文章失败";
    }
  } finally {
    if (request === loadRequest) loading.value = false;
  }
}

watch(() => route.params.id, (id) => loadPost(id), { immediate: true });

const rendered = computed(() => {
  if (!post.value?.content) return { html: "", headings: [] };
  const result = renderMarkdown(md, post.value.content);
  return {
    html: DOMPurify.sanitize(result.html, MARKDOWN_SANITIZE_OPTIONS),
    headings: result.headings.filter((heading) => heading.level >= 2 && heading.level <= 4),
  };
});
const renderedHtml = computed(() => rendered.value.html);
const headings = computed(() => rendered.value.headings);

const readKindLabel = computed(() => {
  if (post.value?.kind === POST_KIND.journal) return "游记";
  if (post.value?.kind === POST_KIND.knowledge) return "知识学习";
  return "题解";
});
const defaultTitle = computed(() => {
  if (post.value?.kind === POST_KIND.journal) return "未命名游记";
  if (post.value?.kind === POST_KIND.knowledge) return "未命名知识学习";
  return "未命名题解";
});
const archiveLabel = computed(() => {
  if (post.value?.kind === POST_KIND.journal) return "返回首页";
  if (post.value?.kind === POST_KIND.knowledge) return "返回知识学习";
  return "返回题解归档";
});
const archiveTarget = computed(() => {
  if (post.value?.kind === POST_KIND.journal) return "/#journal";
  if (post.value?.kind === POST_KIND.knowledge) return "/knowledge";
  return "/solutions";
});
const readTime = computed(() => readingMinutes(post.value?.content));
const showUpdatedDate = computed(() => {
  if (!post.value?.publishedAt || !post.value?.updatedAt) return false;
  return formatDate(post.value.updatedAt) !== formatDate(post.value.publishedAt);
});

const previousPost = computed(() => {
  if (!post.value) return null;
  const published = post.value.publishedAt || 0;
  return relatedPosts.value
    .filter((item) => (item.publishedAt || 0) < published)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))[0] || null;
});
const nextPost = computed(() => {
  if (!post.value) return null;
  const published = post.value.publishedAt || 0;
  return relatedPosts.value
    .filter((item) => (item.publishedAt || 0) > published)
    .sort((a, b) => (a.publishedAt || 0) - (b.publishedAt || 0))[0] || null;
});

function updateProgress() {
  const article = markdownPreview.value;
  if (!article) {
    readProgress.value = 0;
    return;
  }
  const start = article.getBoundingClientRect().top + window.scrollY - 96;
  const distance = Math.max(1, article.offsetHeight - window.innerHeight * 0.45);
  readProgress.value = Math.min(100, Math.max(0, ((window.scrollY - start) / distance) * 100));
}

function disconnectHeadingObserver() {
  headingObserver?.disconnect();
  headingObserver = null;
}

function bindRenderedArticle() {
  nextTick(() => {
    const root = markdownPreview.value;
    if (!root) return;
    attachCopyButtons(root);
    disconnectHeadingObserver();
    const elements = [...root.querySelectorAll("h2[id], h3[id], h4[id]")];
    if (elements.length && "IntersectionObserver" in window) {
      headingObserver = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) activeHeadingId.value = visible[0].target.id;
      }, { rootMargin: "-88px 0px -68% 0px", threshold: [0, 1] });
      elements.forEach((element) => headingObserver.observe(element));
    }
    if (route.hash) {
      try {
        const id = decodeURIComponent(route.hash.slice(1));
        const hashKey = `${post.value?.id || ""}:${id}`;
        const target = document.getElementById(id);
        if (target && root.contains(target) && appliedRouteHash !== hashKey) {
          appliedRouteHash = hashKey;
          activeHeadingId.value = id;
          window.requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
        }
      } catch {
        // Ignore malformed percent-encoding in manually edited hashes.
      }
    }
    updateProgress();
  });
}

watch(renderedHtml, bindRenderedArticle, { flush: "post" });
watch(() => route.hash, bindRenderedArticle, { flush: "post" });

function scrollToHeading(id) {
  const element = document.getElementById(id);
  if (!element) return;
  activeHeadingId.value = id;
  tocOpen.value = false;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
  if (history.replaceState) history.replaceState(null, "", `#${encodeURIComponent(id)}`);
}

async function shareArticle() {
  const url = window.location.href;
  const title = post.value?.title || defaultTitle.value;
  try {
    if (navigator.share) await navigator.share({ title, url });
    else {
      await copyTextToClipboard(url);
      pushToast("文章链接已复制", "success");
    }
  } catch (error) {
    if (error?.name !== "AbortError") pushToast("分享失败，请手动复制地址", "error");
  }
}

function requestLogin() {
  router.push({ name: "login", query: { next: route.fullPath } });
}

watch(
  () => [post.value?.id, post.value?.title, defaultTitle.value],
  () => {
    if (!post.value) return;
    document.title = `${(post.value.title || "").trim() || defaultTitle.value} · ${SITE_TITLE}`;
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });
  bindRenderedArticle();
});

onBeforeUnmount(() => {
  loadRequest += 1;
  disconnectHeadingObserver();
  window.removeEventListener("scroll", updateProgress);
  window.removeEventListener("resize", updateProgress);
});
</script>

<template>
  <div class="read-progress" aria-hidden="true">
    <span :style="{ width: `${readProgress}%` }"></span>
  </div>
  <main class="container read-page">
    <section v-if="loading" class="read-skeleton" aria-label="正在加载文章">
      <div class="read-skeleton-line read-skeleton-short"></div>
      <div class="read-skeleton-line read-skeleton-title"></div>
      <div class="read-skeleton-line"></div>
      <div class="read-skeleton-body"></div>
    </section>
    <section v-else-if="loadError" class="empty-state read-error" role="alert">
      <h1>文章加载失败</h1>
      <p>{{ loadError }}</p>
      <button class="btn btn-primary" type="button" @click="loadPost(route.params.id)">重新加载</button>
    </section>
    <template v-else-if="post">
      <nav class="read-breadcrumb" aria-label="面包屑导航">
        <RouterLink to="/">首页</RouterLink><span aria-hidden="true">/</span>
        <RouterLink :to="archiveTarget">{{ readKindLabel }}</RouterLink><span aria-hidden="true">/</span>
        <span aria-current="page">正文</span>
      </nav>

      <article class="read-shell">
        <header class="read-hero">
          <div class="read-hero-topline">
            <span class="read-kind-badge">{{ readKindLabel }}</span>
            <span v-if="post.status !== 'published'" class="read-draft-badge">草稿预览</span>
          </div>
          <h1>{{ post.title || defaultTitle }}</h1>
          <p v-if="post.summary" class="read-summary">{{ post.summary }}</p>
          <div class="read-meta">
            <span>发布于 {{ formatDate(post.publishedAt || post.updatedAt) }}</span>
            <span v-if="showUpdatedDate">更新于 {{ formatDate(post.updatedAt) }}</span>
            <span>约 {{ readTime }} 分钟阅读</span>
          </div>
          <div class="read-hero-footer">
            <div v-if="post.tags?.length" class="tag-list read-tags">
              <span v-for="tag in post.tags" :key="tag">{{ tag }}</span>
            </div>
            <button class="read-share-btn" type="button" @click="shareArticle">分享文章</button>
          </div>
        </header>

        <button
          v-if="headings.length"
          class="btn btn-ghost read-toc-toggle"
          type="button"
          :aria-expanded="tocOpen"
          aria-controls="article-toc"
          @click="tocOpen = !tocOpen"
        >
          {{ tocOpen ? "收起目录" : `文章目录 · ${headings.length} 节` }}
        </button>

        <div class="read-layout" :class="{ 'read-layout-with-toc': headings.length }">
          <aside v-if="headings.length" id="article-toc" class="read-toc" :class="{ 'read-toc-open': tocOpen }">
            <p class="read-toc-title">本文目录</p>
            <ol>
              <li v-for="heading in headings" :key="heading.id" :class="`toc-level-${heading.level}`">
                <button
                  type="button"
                  :class="{ 'is-active': activeHeadingId === heading.id }"
                  @click="scrollToHeading(heading.id)"
                >
                  {{ heading.text }}
                </button>
              </li>
            </ol>
          </aside>
          <div class="read-content-column">
            <article ref="markdownPreview" class="markdown-preview read-markdown" v-html="renderedHtml"></article>

            <nav class="read-post-nav" aria-label="相邻文章">
              <RouterLink v-if="previousPost" :to="`/posts/${previousPost.id}`" class="read-post-nav-item">
                <small>← 较早一篇</small><strong>{{ previousPost.title || defaultTitle }}</strong>
              </RouterLink>
              <span v-else class="read-post-nav-item is-disabled"><small>← 较早一篇</small><strong>已经到底了</strong></span>
              <RouterLink v-if="nextPost" :to="`/posts/${nextPost.id}`" class="read-post-nav-item read-post-nav-next">
                <small>较新一篇 →</small><strong>{{ nextPost.title || defaultTitle }}</strong>
              </RouterLink>
              <span v-else class="read-post-nav-item read-post-nav-next is-disabled"><small>较新一篇 →</small><strong>这就是最新文章</strong></span>
            </nav>

            <RouterLink class="read-back-link" :to="archiveTarget">← {{ archiveLabel }}</RouterLink>
          </div>
        </div>
      </article>

      <section v-if="post.status === 'published'" class="panel comment-panel">
        <CommentSection :key="post.id" :postId="post.id" @need-login="requestLogin" />
      </section>
    </template>
    <section v-else class="empty-state read-error">
      <h1>没有找到这篇文章</h1>
      <p>它可能尚未发布、已被移除，或链接有误。</p>
      <RouterLink class="btn btn-primary" to="/solutions">返回题解归档</RouterLink>
    </section>
  </main>
</template>
