<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DOMPurify from "dompurify";
import {
  DP_KNOWLEDGE_ARTICLE,
  DP_KNOWLEDGE_MARKDOWN,
  DP_SECTIONS,
  isDpKnowledgePost,
} from "../content/dp-optimization";
import { POST_KIND } from "../utils/postStorage";
import { loadPost, loadPosts } from "../utils/postStore";
import { SORT_OPTIONS, sortPosts } from "../utils/postFilter";
import {
  attachCopyButtons,
  createMarkdownIt,
  MARKDOWN_SANITIZE_OPTIONS,
  renderMarkdown,
} from "../utils/markdownRenderer";
import { createMathEngineLoader, hasMath } from "../utils/markdownMath";
import "katex/dist/katex.min.css";

// 动态 import 必须留在视图内，katex 才会成为本页专属 chunk 而不污染入口。
const loadMathEngine = createMathEngineLoader(() => import("katex"));

const route = useRoute();
const router = useRouter();
const md = createMarkdownIt();
const sections = DP_SECTIONS;
const activeId = ref("intro");
const contentRoot = ref(null);
const tocOpen = ref(false);
const knowledgePosts = ref([]);
const knowledgeLoading = ref(true);
const knowledgeError = ref("");
const activeArticle = ref(DP_KNOWLEDGE_ARTICLE);
// 文档里出现公式时置位，避免在 katex 就绪前渲染出原样 LaTeX。
const mathReady = ref(false);

const activeSource = computed(
  () => activeArticle.value?.content || DP_KNOWLEDGE_MARKDOWN
);

/** 只有文档可能含公式时才引入 katex，纯文字笔记不受影响。 */
async function ensureMathEngine(source) {
  if (mathReady.value) return;
  if (!hasMath(source)) return;
  await loadMathEngine();
  mathReady.value = true;
}

/** Keep the old section ids while rendering the new single Markdown source. */
function addLegacySectionIds(html) {
  let headingIndex = 0;
  return String(html || "").replace(
    /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (whole, level, attrs, inner) => {
      if (Number(level) > 2) return whole;
      const plainHeading = String(inner || "").replace(/<[^>]+>/g, "").trim();
      const numbered = plainHeading.match(/^(?:第\s*)?(\d+)[.、：:]/);
      const section = Number(level) === 1 && headingIndex === 0
        ? sections[0]
        : numbered?.[1] && sections[Number(numbered[1])]
          ? sections[Number(numbered[1])]
          : sections[headingIndex];
      headingIndex += 1;
      if (!section) return whole;
      const withoutId = String(attrs || "").replace(/\s+id="[^"]*"/i, "");
      return `<h${level}${withoutId} id="${section.id}">${inner}</h${level}>`;
    },
  );
}

const renderedDocumentHtml = computed(() => {
  // 读到 mathReady 是为了在 katex 到位后重新计算一次，届时公式才会真正排版。
  if (!mathReady.value && hasMath(activeSource.value)) return "";
  const { html } = renderMarkdown(md, activeSource.value);
  return DOMPurify.sanitize(addLegacySectionIds(html), MARKDOWN_SANITIZE_OPTIONS);
});

function scrollToSection(id, replaceHash = true) {
  activeId.value = id;
  tocOpen.value = false;
  if (replaceHash && route.hash !== `#${id}`) {
    router.replace({ hash: `#${id}` });
    return;
  }
  nextTick(() => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function bindCopyButtons() {
  nextTick(() => {
    if (contentRoot.value) attachCopyButtons(contentRoot.value);
  });
}

function updateActiveFromScroll() {
  const offset = 120;
  let current = sections[0]?.id || "intro";
  for (const section of sections) {
    const element = document.getElementById(section.id);
    if (element && element.getBoundingClientRect().top <= offset) current = section.id;
  }
  if (current !== activeId.value) activeId.value = current;
}

function handleHashOnLoad() {
  let hash = route.hash.replace(/^#/, "");
  try {
    hash = decodeURIComponent(hash);
  } catch {
    // Keep the raw hash when a user enters malformed percent encoding.
  }
  if (!hash) return;
  const section = sections.find((item) => item.id === hash);
  nextTick(() => {
    const element = document.getElementById(section?.id || hash);
    if (!element) return;
    if (section) activeId.value = section.id;
    const top = element.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

async function loadKnowledgePosts() {
  knowledgeLoading.value = true;
  knowledgeError.value = "";
  activeArticle.value = DP_KNOWLEDGE_ARTICLE;
  // 内置文档是默认可见内容，先把它的公式渲染能力准备好，避免闪一下原样 LaTeX。
  await ensureMathEngine(DP_KNOWLEDGE_MARKDOWN);
  try {
    const published = (await loadPosts({ includeDrafts: false }))
      .filter((post) => post.kind === POST_KIND.knowledge && post.status === "published");
    const managedMeta = published.find(isDpKnowledgePost);
    if (managedMeta) {
      try {
        const managedArticle = await loadPost(managedMeta.id);
        if (managedArticle?.content?.trim()) {
          await ensureMathEngine(managedArticle.content);
          activeArticle.value = { ...DP_KNOWLEDGE_ARTICLE, ...managedArticle, isBuiltin: false };
        }
      } catch {
        // The bundled Markdown remains available if the managed body cannot
        // be read (for example, while a remote project is being migrated).
      }
    }
    knowledgePosts.value = sortPosts(published, SORT_OPTIONS.published);
  } catch (error) {
    knowledgePosts.value = [];
    knowledgeError.value = error?.message || "读取知识学习文章失败";
  } finally {
    knowledgeLoading.value = false;
  }
}

watch(renderedDocumentHtml, bindCopyButtons, { flush: "post" });
watch(() => route.hash, handleHashOnLoad);

onMounted(() => {
  void loadKnowledgePosts();
  bindCopyButtons();
  handleHashOnLoad();
  window.addEventListener("scroll", updateActiveFromScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", updateActiveFromScroll);
});
</script>

<template>
  <div class="dp-wiki">
    <header class="dp-hero container">
      <p class="dp-hero-tag">DP OPTIMIZATION · KNOWLEDGE</p>
      <h1 class="dp-hero-title">{{ activeArticle.title }}</h1>
      <p class="dp-hero-desc">{{ activeArticle.summary }}</p>
      <div class="hero-actions">
        <RouterLink class="btn btn-primary" to="/knowledge">浏览全部知识学习</RouterLink>
      </div>
    </header>

    <section v-if="knowledgeLoading" class="container comment-status">正在读取知识学习文章...</section>
    <section v-else-if="knowledgeError" class="container auth-error">
      {{ knowledgeError }}（下方内置专题仍可正常阅读）
    </section>
    <section v-else-if="knowledgePosts.length" class="container section dp-related-knowledge">
      <div class="section-title-row">
        <h2>最新知识学习</h2>
        <RouterLink class="section-link" to="/knowledge">查看全部 →</RouterLink>
      </div>
      <div class="card-grid">
        <article v-for="post in knowledgePosts.slice(0, 3)" :key="post.id" class="card">
          <p class="card-meta">知识学习 · {{ post.tags?.length ? post.tags.join(" / ") : "未分类" }}</p>
          <h3><RouterLink :to="`/posts/${post.id}`">{{ post.title || "未命名知识学习" }}</RouterLink></h3>
          <p>{{ post.summary || "点击阅读完整学习笔记。" }}</p>
        </article>
      </div>
    </section>

    <div class="container dp-layout">
      <aside class="dp-toc" :class="{ 'dp-toc-open': tocOpen }">
        <div class="dp-toc-head">
          <h2>目录</h2>
          <button type="button" class="dp-toc-close btn btn-ghost" @click="tocOpen = false">收起</button>
        </div>
        <nav aria-label="DP 优化章节目录">
          <button
            v-for="section in sections"
            :key="section.id"
            type="button"
            class="dp-toc-item"
            :class="{ 'dp-toc-item-active': activeId === section.id }"
            @click="scrollToSection(section.id)"
          >
            <span class="dp-toc-num">{{ section.num }}</span>
            <span class="dp-toc-text">
              <strong>{{ section.title }}</strong>
              <small>{{ section.subtitle }}</small>
            </span>
          </button>
        </nav>
      </aside>

      <main class="dp-main">
        <button type="button" class="btn btn-ghost dp-toc-toggle" @click="tocOpen = !tocOpen">
          {{ tocOpen ? "收起目录" : "展开目录" }}
        </button>
        <article ref="contentRoot" class="panel dp-section dp-document markdown-preview" v-html="renderedDocumentHtml"></article>
      </main>
    </div>
  </div>
</template>
