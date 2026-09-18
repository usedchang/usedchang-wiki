<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { createPost, getAllPosts, removePost, POST_KIND } from "../utils/postStorage";
import { pushToast } from "../utils/toast";

const router = useRouter();
const posts = ref([]);
const loading = ref(true);
const loadError = ref("");
const keyword = ref("");
const selectedTag = ref("all");
const selectedStatus = ref("all");
const sortBy = ref("updatedAt-desc");

async function refreshList() {
  loading.value = true;
  loadError.value = "";
  try {
    posts.value = (await getAllPosts({ includeDrafts: true })).filter(
      (p) => p.kind !== POST_KIND.journal
    );
  } catch (error) {
    loadError.value = error?.message || "读取题解失败";
    posts.value = [];
  } finally {
    loading.value = false;
  }
}

async function createSolution() {
  try {
    const post = await createPost({ kind: POST_KIND.solution });
    await refreshList();
    pushToast("已新建题解草稿", "success");
    router.push("/admin/solutions/" + post.id);
  } catch (error) {
    pushToast(error?.message || "新建题解失败", "error", 3200);
  }
}

async function removeSolution(id) {
  const target = posts.value.find((item) => item.id === id);
  if (!confirm("确定删除“" + (target?.title || "未命名题解") + "”吗？")) return;
  try {
    await removePost(id);
    await refreshList();
    pushToast("已删除：" + (target?.title || "未命名题解"), "info");
  } catch (error) {
    pushToast(error?.message || "删除失败", "error", 3200);
  }
}

onMounted(refreshList);

const sortedPosts = computed(() => {
  const list = [...posts.value];
  if (sortBy.value === "publishedAt-desc") {
    return list.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  }
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
});

const allTags = computed(() => {
  const set = new Set();
  for (const post of sortedPosts.value) {
    if (!Array.isArray(post.tags)) continue;
    for (const tag of post.tags) {
      const text = String(tag || "").trim();
      if (text) set.add(text);
    }
  }
  return [...set];
});

const filteredPosts = computed(() => {
  const searchText = keyword.value.trim().toLowerCase();
  return sortedPosts.value.filter((post) => {
    const titleText = String(post.title || "未命名题解").toLowerCase();
    const matchesKeyword = !searchText || titleText.includes(searchText);
    const tags = Array.isArray(post.tags) ? post.tags : [];
    const matchesTag = selectedTag.value === "all" || tags.includes(selectedTag.value);
    const matchesStatus =
      selectedStatus.value === "all" || post.status === selectedStatus.value;
    return matchesKeyword && matchesTag && matchesStatus;
  });
});

const draftPosts = computed(() =>
  filteredPosts.value.filter((post) => post.status !== "published")
);
const publishedPosts = computed(() =>
  filteredPosts.value.filter((post) => post.status === "published")
);

function resetFilters() {
  keyword.value = "";
  selectedTag.value = "all";
  selectedStatus.value = "all";
  sortBy.value = "updatedAt-desc";
}

function formatTime(ts) {
  if (!ts) return "未知时间";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <main class="container section solution-list-page">
    <div class="section-title-row">
      <h2>题解管理</h2>
      <button class="btn btn-primary" @click="createSolution">新增题解</button>
    </div>

    <section class="panel solution-filter-panel">
      <h3 class="panel-title">快速筛选</h3>
      <div class="solution-filter-grid">
        <input
          v-model="keyword"
          placeholder="按标题搜索，如：最短路 / DP / 线段树"
        />
        <select v-model="selectedStatus">
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
        </select>
        <select v-model="selectedTag">
          <option value="all">全部标签</option>
          <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
        <select v-model="sortBy">
          <option value="updatedAt-desc">按更新时间（新到旧）</option>
          <option value="publishedAt-desc">按发布时间（新到旧）</option>
        </select>
      </div>
      <div class="card-actions">
        <button class="btn btn-ghost" @click="resetFilters">清空筛选</button>
        <span class="solution-filter-result">匹配文章：{{ filteredPosts.length }}</span>
      </div>
    </section>

    <p v-if="loadError" class="auth-error">{{ loadError }}</p>
    <p v-else-if="loading" class="comment-status">正在读取题解...</p>

    <section class="panel">
      <h3 class="panel-title">草稿（{{ draftPosts.length }}）</h3>
      <div v-if="draftPosts.length" class="solution-list">
        <article v-for="item in draftPosts" :key="item.id" class="solution-item">
          <div>
            <p class="solution-title">{{ item.title || "未命名题解" }}</p>
            <p class="solution-meta">更新时间：{{ formatTime(item.updatedAt) }}</p>
            <p class="solution-url">独立链接：/posts/{{ item.id }}</p>
          </div>
          <div class="card-actions">
            <RouterLink class="btn btn-ghost" :to="`/posts/${item.id}`">阅读</RouterLink>
            <RouterLink class="btn btn-ghost" :to="`/admin/solutions/${item.id}`">编辑</RouterLink>
            <button class="btn btn-danger" @click="removeSolution(item.id)">删除</button>
          </div>
        </article>
      </div>
      <p v-else class="empty-hint">暂无草稿。</p>
    </section>

    <section class="panel section-gap">
      <h3 class="panel-title">已发布（{{ publishedPosts.length }}）</h3>
      <div v-if="publishedPosts.length" class="solution-list">
        <article v-for="item in publishedPosts" :key="item.id" class="solution-item">
          <div>
            <p class="solution-title">{{ item.title || "未命名题解" }}</p>
            <p class="solution-meta">
              发布时间：{{ formatTime(item.publishedAt) }} · 更新时间：{{ formatTime(item.updatedAt) }}
            </p>
            <p class="solution-url">独立链接：/posts/{{ item.id }}</p>
          </div>
          <div class="card-actions">
            <RouterLink class="btn btn-ghost" :to="`/posts/${item.id}`">阅读</RouterLink>
            <RouterLink class="btn btn-ghost" :to="`/admin/solutions/${item.id}`">编辑</RouterLink>
            <button class="btn btn-danger" @click="removeSolution(item.id)">删除</button>
          </div>
        </article>
      </div>
      <p v-else class="empty-hint">暂无已发布文章。</p>
    </section>

    <div v-if="!sortedPosts.length" class="empty-state">
      还没有题解，点击右上角“新增题解”开始写第一篇。
    </div>

    <div v-else-if="!filteredPosts.length" class="empty-state">
      没有匹配当前筛选条件的文章，换个关键词或标签试试。
    </div>
  </main>
</template>
