<script setup>
import { computed, onMounted, ref } from "vue";
import { getAllPosts, POST_KIND } from "../utils/postStorage";

const posts = ref([]);
const loading = ref(true);
const loadError = ref("");
const keyword = ref("");
const selectedTag = ref("all");

async function loadKnowledge() {
  loading.value = true;
  loadError.value = "";
  try {
    posts.value = (await getAllPosts())
      .filter((post) => post.kind === POST_KIND.knowledge && post.status === "published")
      .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  } catch (error) {
    posts.value = [];
    loadError.value = error?.message || "读取知识学习失败";
  } finally {
    loading.value = false;
  }
}

onMounted(loadKnowledge);

const allTags = computed(() => {
  const tags = new Set();
  posts.value.forEach((post) => (post.tags || []).forEach((tag) => tags.add(String(tag))));
  return [...tags].filter(Boolean);
});

const filteredPosts = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return posts.value.filter((post) => {
    const title = String(post.title || "未命名知识学习").toLowerCase();
    const summary = String(post.summary || "").toLowerCase();
    const tags = Array.isArray(post.tags) ? post.tags : [];
    return (
      (!query || title.includes(query) || summary.includes(query))
      && (selectedTag.value === "all" || tags.includes(selectedTag.value))
    );
  });
});

function formatDate(timestamp) {
  if (!timestamp) return "日期未知";
  return new Date(timestamp).toLocaleDateString("zh-CN");
}
</script>

<template>
  <main class="container solution-archive-page knowledge-archive-page">
    <header class="solution-archive-hero">
      <p class="archive-eyebrow">KNOWLEDGE · 学习笔记</p>
      <h1>知识学习</h1>
      <p>把算法、工具和思考整理成可持续更新的 Markdown 笔记。</p>
      <div class="archive-stats" aria-label="知识学习统计">
        <span><strong>{{ posts.length }}</strong> 篇笔记</span>
        <RouterLink class="btn btn-ghost" to="/dp-optimization">查看 DP 优化专题</RouterLink>
      </div>
    </header>

    <section class="archive-toolbar" aria-label="筛选知识学习">
      <label class="archive-search">
        <span class="sr-only">搜索知识学习</span>
        <input v-model="keyword" type="search" placeholder="搜索标题或摘要" />
      </label>
      <label>
        <span class="sr-only">按标签筛选</span>
        <select v-model="selectedTag">
          <option value="all">全部标签</option>
          <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
      </label>
      <span class="archive-result">{{ filteredPosts.length }} 篇结果</span>
    </section>

    <section v-if="loadError" class="empty-state archive-state" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn btn-primary" type="button" @click="loadKnowledge">重新加载</button>
    </section>
    <section v-else-if="loading" class="archive-grid" aria-label="正在加载知识学习">
      <article v-for="item in 3" :key="item" class="solution-archive-card archive-card-skeleton"></article>
    </section>
    <section v-else-if="filteredPosts.length" class="archive-grid">
      <article v-for="post in filteredPosts" :key="post.id" class="solution-archive-card">
        <div class="archive-card-topline">
          <time>{{ formatDate(post.publishedAt || post.updatedAt) }}</time>
          <span>{{ post.tags?.length ? `${post.tags.length} 个标签` : "知识学习" }}</span>
        </div>
        <h2><RouterLink :to="`/posts/${post.id}`">{{ post.title || "未命名知识学习" }}</RouterLink></h2>
        <p class="archive-card-summary">{{ post.summary || "点击查看完整学习笔记。" }}</p>
        <div class="archive-card-footer">
          <div class="tag-list archive-card-tags">
            <button
              v-for="tag in (post.tags || []).slice(0, 4)"
              :key="tag"
              type="button"
              @click="selectedTag = tag"
            >
              {{ tag }}
            </button>
          </div>
          <RouterLink class="archive-read-link" :to="`/posts/${post.id}`">
            阅读笔记 <span aria-hidden="true">→</span>
          </RouterLink>
        </div>
      </article>
    </section>
    <section v-else class="empty-state archive-state">
      <p>{{ posts.length ? "没有匹配当前条件的知识笔记。" : "知识学习文章正在整理中。" }}</p>
      <RouterLink class="btn btn-primary" to="/dp-optimization">先阅读 DP 优化专题</RouterLink>
    </section>
  </main>
</template>
