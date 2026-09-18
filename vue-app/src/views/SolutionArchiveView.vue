<script setup>
import { computed, onMounted, ref } from "vue";
import { getAllPosts, POST_KIND } from "../utils/postStorage";

const posts = ref([]);
const loading = ref(true);
const loadError = ref("");
const keyword = ref("");
const selectedTag = ref("all");

async function loadSolutions() {
  loading.value = true;
  loadError.value = "";
  try {
    posts.value = (await getAllPosts())
      .filter((post) => post.kind === POST_KIND.solution && post.status === "published")
      .sort((a, b) => (b.publishedAt || b.updatedAt || 0) - (a.publishedAt || a.updatedAt || 0));
  } catch (error) {
    loadError.value = error?.message || "读取题解失败";
    posts.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(loadSolutions);

const allTags = computed(() => {
  const tags = new Set();
  for (const post of posts.value) {
    for (const tag of post.tags || []) {
      const text = String(tag || "").trim();
      if (text) tags.add(text);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b, "zh-CN"));
});

const filteredPosts = computed(() => {
  const search = keyword.value.trim().toLocaleLowerCase("zh-CN");
  return posts.value.filter((post) => {
    const tags = Array.isArray(post.tags) ? post.tags : [];
    const searchable = [post.title, post.summary, ...tags]
      .map((item) => String(item || "").toLocaleLowerCase("zh-CN"))
      .join("\n");
    return (!search || searchable.includes(search))
      && (selectedTag.value === "all" || tags.includes(selectedTag.value));
  });
});

function formatDate(value) {
  if (!value) return "日期未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function dateTimeValue(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

</script>

<template>
  <main class="container solution-archive-page">
    <header class="solution-archive-hero">
      <p class="archive-eyebrow">SOLUTIONS · 解题档案</p>
      <h1>题解归档</h1>
      <p>把关键转化、证明与实现细节沉淀成可检索的解题笔记。</p>
      <div class="archive-stats" aria-label="题解统计">
        <span><strong>{{ posts.length }}</strong> 篇题解</span>
        <span><strong>{{ allTags.length }}</strong> 个标签</span>
      </div>
    </header>

    <section class="archive-toolbar" aria-label="筛选题解">
      <label class="archive-search">
        <span class="sr-only">搜索题解</span>
        <input v-model="keyword" type="search" placeholder="搜索标题、摘要或标签…" />
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
      <button class="btn btn-primary" type="button" @click="loadSolutions">重新加载</button>
    </section>
    <section v-else-if="loading" class="archive-grid" aria-label="正在加载题解">
      <article v-for="item in 3" :key="item" class="solution-archive-card archive-card-skeleton"></article>
    </section>
    <section v-else-if="filteredPosts.length" class="archive-grid">
      <article v-for="item in filteredPosts" :key="item.id" class="solution-archive-card">
        <div class="archive-card-topline">
          <time :datetime="dateTimeValue(item.publishedAt || item.updatedAt)">
            {{ formatDate(item.publishedAt || item.updatedAt) }}
          </time>
          <span>{{ item.tags?.length ? `${item.tags.length} 个标签` : "XCPC 题解" }}</span>
        </div>
        <h2>
          <RouterLink :to="`/posts/${item.id}`">{{ item.title || "未命名题解" }}</RouterLink>
        </h2>
        <p class="archive-card-summary">{{ item.summary || "这篇题解暂未填写摘要，点击查看完整思路与代码。" }}</p>
        <div class="archive-card-footer">
          <div class="tag-list archive-card-tags">
            <button
              v-for="tag in (item.tags || []).slice(0, 4)"
              :key="tag"
              type="button"
              @click="selectedTag = tag"
            >
              {{ tag }}
            </button>
          </div>
          <RouterLink class="archive-read-link" :to="`/posts/${item.id}`">
            阅读题解 <span aria-hidden="true">→</span>
          </RouterLink>
        </div>
      </article>
    </section>
    <section v-else class="empty-state archive-state">
      <p>{{ posts.length ? "没有匹配当前条件的题解。" : "题解正在整理中，稍后再来看看。" }}</p>
      <button v-if="posts.length" class="btn btn-ghost" type="button" @click="keyword = ''; selectedTag = 'all'">
        清空筛选
      </button>
    </section>
  </main>
</template>
