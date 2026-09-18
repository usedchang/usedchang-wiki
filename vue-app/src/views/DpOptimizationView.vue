<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DOMPurify from "dompurify";
import { DP_SECTIONS } from "../content/dp-optimization";
import { getAllPosts, POST_KIND } from "../utils/postStorage";
import {
  createMarkdownIt,
  attachCopyButtons,
  MARKDOWN_SANITIZE_OPTIONS,
} from "../utils/markdownRenderer";
import "katex/dist/katex.min.css";

const route = useRoute();
const router = useRouter();
const md = createMarkdownIt();
const activeId = ref("intro");
const contentRoot = ref(null);
const tocOpen = ref(false);
const knowledgePosts = ref([]);
const knowledgeLoading = ref(true);
const knowledgeError = ref("");

const sections = DP_SECTIONS;

const renderedSections = computed(() =>
  sections.map((section) => ({
    ...section,
    html: DOMPurify.sanitize(md.render(section.markdown), MARKDOWN_SANITIZE_OPTIONS),
  }))
);

function scrollToSection(id, replaceHash = true) {
  activeId.value = id;
  // 移动端先关闭目录，避免布局偏移导致定位不准
  tocOpen.value = false;

  if (replaceHash && route.hash !== `#${id}`) {
    // 由 scrollBehavior 根据 hash 驱动滚动，复用浏览器原生 scrollIntoView
    router.replace({ hash: `#${id}` });
  } else {
    // hash 已匹配时手动滚动
    nextTick(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function bindCopyButtons() {
  nextTick(() => {
    const root = contentRoot.value;
    if (root) attachCopyButtons(root);
  });
}

function updateActiveFromScroll() {
  const offset = 120;
  let current = sections[0]?.id ?? "intro";
  for (const section of sections) {
    const el = document.getElementById(section.id);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= offset) current = section.id;
  }
  if (current !== activeId.value) activeId.value = current;
}

// scrollBehavior 已处理初次 hash 滚动，这里仅同步 activeId 高亮
// 保留 nextTick 兜底：若 scrollBehavior 未命中（极少情况）则补一次滚动
function handleHashOnLoad() {
  const hash = route.hash.replace("#", "");
  if (hash && sections.some((s) => s.id === hash)) {
    activeId.value = hash;
    nextTick(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      // 仅当元素离视口较远时才补滚动，避免和 scrollBehavior 冲突
      const top = el.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

async function loadKnowledgePosts() {
  knowledgeLoading.value = true;
  knowledgeError.value = "";
  try {
    knowledgePosts.value = (await getAllPosts())
      .filter((post) => post.kind === POST_KIND.knowledge && post.status === "published")
      .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  } catch (error) {
    knowledgePosts.value = [];
    knowledgeError.value = error?.message || "读取知识学习文章失败";
  } finally {
    knowledgeLoading.value = false;
  }
}

watch(renderedSections, bindCopyButtons, { flush: "post" });

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
      <p class="dp-hero-tag">DP OPTIMIZATION · WIKI</p>
      <h1 class="dp-hero-title">动态规划优化方法</h1>
      <p class="dp-hero-desc">
        从状态设计到卷积加速，系统整理六类常见 DP 优化手段。
      </p>
      <div class="hero-actions">
        <RouterLink class="btn btn-primary" to="/knowledge">浏览全部知识学习</RouterLink>
      </div>
    </header>

    <section v-if="knowledgeLoading" class="container comment-status">
      正在读取知识学习文章...
    </section>
    <section v-else-if="knowledgeError" class="container auth-error">
      {{ knowledgeError }}（下方静态专题仍可正常阅读）
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
          <button type="button" class="dp-toc-close btn btn-ghost" @click="tocOpen = false">
            收起
          </button>
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

      <div class="dp-main">
        <button type="button" class="btn btn-ghost dp-toc-toggle" @click="tocOpen = !tocOpen">
          {{ tocOpen ? "收起目录" : "展开目录" }}
        </button>

        <div ref="contentRoot" class="dp-sections">
          <section
            v-for="section in renderedSections"
            :id="section.id"
            :key="section.id"
            class="panel dp-section"
          >
            <header class="dp-section-head">
              <p class="dp-section-num">{{ section.num }}</p>
              <div>
                <h2 class="dp-section-title">{{ section.title }}</h2>
                <p class="dp-section-sub">{{ section.subtitle }}</p>
              </div>
            </header>
            <article class="markdown-preview dp-markdown" v-html="section.html"></article>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
