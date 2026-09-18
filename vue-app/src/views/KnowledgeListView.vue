<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { createPost, getAllPosts, removePost, POST_KIND } from "../utils/postStorage";
import { pushToast } from "../utils/toast";
import {
  DP_KNOWLEDGE_ARTICLE,
  DP_KNOWLEDGE_SOURCE,
  isDpKnowledgePost,
} from "../content/dp-optimization";

const route = useRoute();
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
      (post) => post.kind === POST_KIND.knowledge
    );
  } catch (error) {
    loadError.value = error?.message || "读取知识学习失败";
    posts.value = [];
  } finally {
    loading.value = false;
  }
}

async function createKnowledge() {
  try {
    const post = await createPost({ kind: POST_KIND.knowledge });
    await refreshList();
    pushToast("已新建知识学习草稿", "success");
    router.push(`/admin/knowledge/${post.id}`);
  } catch (error) {
    pushToast(error?.message || "新建知识学习失败", "error", 3200);
  }
}

/** Create a normal knowledge post populated with the built-in DP Markdown. */
async function importDpKnowledge() {
  const existing = posts.value.find(isDpKnowledgePost);
  if (existing) {
    router.push(`/admin/knowledge/${existing.id}`);
    return;
  }
  try {
    const post = await createPost({ kind: POST_KIND.knowledge });
    await refreshList();
    pushToast("已创建 DP 优化知识学习草稿，请检查后保存或发布", "success");
    router.push({
      name: "admin-knowledge-editor",
      params: { id: post.id },
      query: { source: DP_KNOWLEDGE_SOURCE },
    });
  } catch (error) {
    pushToast(error?.message || "导入 DP 优化专题失败", "error", 3200);
  }
}

async function removeKnowledge(id) {
  const target = posts.value.find((item) => item.id === id);
  if (!confirm(`确定删除“${target?.title || "未命名知识学习"}”吗？`)) return;
  try {
    await removePost(id);
    await refreshList();
    pushToast(`已删除：${target?.title || "未命名知识学习"}`, "info");
  } catch (error) {
    pushToast(error?.message || "删除失败", "error", 3200);
  }
}

onMounted(async () => {
  await refreshList();
  if (route.query.source === DP_KNOWLEDGE_SOURCE) await importDpKnowledge();
});

const sortedPosts = computed(() => {
  const list = [...posts.value];
  if (sortBy.value === "publishedAt-desc") {
    return list.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  }
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
});

const allTags = computed(() => {
  const set = new Set();
  sortedPosts.value.forEach((post) => {
    (Array.isArray(post.tags) ? post.tags : []).forEach((tag) => {
      const text = String(tag || "").trim();
      if (text) set.add(text);
    });
  });
  return [...set];
});

const filteredPosts = computed(() => {
  const searchText = keyword.value.trim().toLowerCase();
  return sortedPosts.value.filter((post) => {
    const title = String(post.title || "未命名知识学习").toLowerCase();
    const tags = Array.isArray(post.tags) ? post.tags : [];
    return (
      (!searchText || title.includes(searchText))
      && (selectedTag.value === "all" || tags.includes(selectedTag.value))
      && (selectedStatus.value === "all" || post.status === selectedStatus.value)
    );
  });
});

const draftPosts = computed(() => filteredPosts.value.filter((post) => post.status !== "published"));
const publishedPosts = computed(() => filteredPosts.value.filter((post) => post.status === "published"));
const hasImportedDp = computed(() => posts.value.some(isDpKnowledgePost));

function resetFilters() {
  keyword.value = "";
  selectedTag.value = "all";
  selectedStatus.value = "all";
  sortBy.value = "updatedAt-desc";
}

function formatTime(timestamp) {
  if (!timestamp) return "未知时间";
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <main class="container section solution-list-page knowledge-list-page">
    <div class="section-title-row">
      <div>
        <h2>知识学习管理</h2>
        <p class="editor-tip">像编辑题解和游记一样，直接在前端整理知识笔记。</p>
      </div>
      <div class="card-actions">
        <button v-if="!hasImportedDp" class="btn btn-ghost" type="button" @click="importDpKnowledge">
          导入 DP 优化专题
        </button>
        <button class="btn btn-primary" type="button" @click="createKnowledge">新建知识学习</button>
      </div>
    </div>

    <section class="panel solution-filter-panel">
      <h3 class="panel-title">快速筛选</h3>
      <div class="solution-filter-grid">
        <input v-model="keyword" placeholder="按标题搜索，如：图论 / DP / 数学" />
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
        <button class="btn btn-ghost" type="button" @click="resetFilters">清空筛选</button>
        <span class="solution-filter-result">匹配文章：{{ filteredPosts.length }}</span>
      </div>
    </section>

    <p v-if="loadError" class="auth-error">{{ loadError }}</p>
    <p v-else-if="loading" class="comment-status">正在读取知识学习...</p>

    <section v-if="!loading && !hasImportedDp" class="panel section-gap">
      <div class="section-title-row">
        <div>
          <p class="solution-title">{{ DP_KNOWLEDGE_ARTICLE.title }}</p>
          <p class="solution-meta">内置 Markdown 知识文档 · 尚未导入文章库</p>
          <p class="editor-tip">{{ DP_KNOWLEDGE_ARTICLE.summary }}</p>
        </div>
        <div class="card-actions">
          <RouterLink class="btn btn-ghost" to="/knowledge/dp-optimization">预览</RouterLink>
          <button class="btn btn-primary" type="button" @click="importDpKnowledge">导入并编辑</button>
        </div>
      </div>
    </section>

    <section class="panel">
      <h3 class="panel-title">草稿（{{ draftPosts.length }}）</h3>
      <div v-if="draftPosts.length" class="solution-list">
        <article v-for="item in draftPosts" :key="item.id" class="solution-item">
          <div>
            <p class="solution-title">{{ item.title || "未命名知识学习" }}</p>
            <p class="solution-meta">更新时间：{{ formatTime(item.updatedAt) }}</p>
            <p class="solution-url">阅读链接：/posts/{{ item.id }}</p>
          </div>
          <div class="card-actions">
            <RouterLink class="btn btn-ghost" :to="`/posts/${item.id}`">预览</RouterLink>
            <RouterLink class="btn btn-ghost" :to="`/admin/knowledge/${item.id}`">编辑</RouterLink>
            <button class="btn btn-danger" type="button" @click="removeKnowledge(item.id)">删除</button>
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
            <p class="solution-title">{{ item.title || "未命名知识学习" }}</p>
            <p class="solution-meta">
              发布时间：{{ formatTime(item.publishedAt) }} · 更新时间：{{ formatTime(item.updatedAt) }}
            </p>
            <p class="solution-url">阅读链接：/posts/{{ item.id }}</p>
          </div>
          <div class="card-actions">
            <RouterLink class="btn btn-ghost" :to="`/posts/${item.id}`">阅读</RouterLink>
            <RouterLink class="btn btn-ghost" :to="`/admin/knowledge/${item.id}`">编辑</RouterLink>
            <button class="btn btn-danger" type="button" @click="removeKnowledge(item.id)">删除</button>
          </div>
        </article>
      </div>
      <p v-else class="empty-hint">暂无已发布知识学习。</p>
    </section>

    <div v-if="!sortedPosts.length" class="empty-state">
      还没有数据库知识文章，可先导入上方「动态规划优化方法」或新建知识学习。
    </div>
    <div v-else-if="!filteredPosts.length" class="empty-state">
      没有匹配当前筛选条件的文章，换个关键词或标签试试。
    </div>
  </main>
</template>
