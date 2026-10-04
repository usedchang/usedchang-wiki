<script setup>
import { computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { usePostList } from "../composables/usePostList";
import { createPost, POST_KIND } from "../utils/postStorage";
import { pushToast } from "../utils/toast";
import {
  DP_KNOWLEDGE_ARTICLE,
  DP_KNOWLEDGE_SOURCE,
  isDpKnowledgePost,
} from "../content/dp-optimization";

const route = useRoute();
const router = useRouter();

const {
  template,
  loading,
  loadError,
  keyword,
  selectedTag,
  selectedStatus,
  sortBy,
  posts,
  filteredPosts,
  draftPosts,
  publishedPosts,
  allTags,
  emptyHint,
  resetFilters,
  removeById,
  rememberCreated,
  formatTime,
  load,
  hasPosts,
} = usePostList({ kind: POST_KIND.knowledge });

const EDIT_PATH = (id) => `/admin/knowledge/${id}`;
const READ_PATH = (id) => `/posts/${id}`;

const hasImportedDp = computed(() => posts.value.some(isDpKnowledgePost));

async function createKnowledge() {
  try {
    const post = await createPost({ kind: POST_KIND.knowledge });
    rememberCreated(post);
    pushToast(template.value.newToast, "success");
    router.push(EDIT_PATH(post.id));
  } catch (error) {
    pushToast(error?.message || template.value.createError, "error", 3200);
  }
}

/** 新建一篇普通知识文章，正文填入内置的 DP 优化 Markdown。 */
async function importDpKnowledge() {
  // 可能由「导入」按钮或 ?source= 查询参数触发，先确保列表已加载，
  // 否则会在已有 DP 文章时重复创建。
  if (!hasPosts.value) await load();
  const existing = posts.value.find(isDpKnowledgePost);
  if (existing) {
    router.push(EDIT_PATH(existing.id));
    return;
  }
  try {
    const post = await createPost({ kind: POST_KIND.knowledge });
    rememberCreated(post);
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

onMounted(() => {
  if (route.query.source === DP_KNOWLEDGE_SOURCE) importDpKnowledge();
});
</script>

<template>
  <main class="container section solution-list-page knowledge-list-page">
    <div class="section-title-row">
      <div>
        <h1>{{ template.adminLabel }}</h1>
        <p class="editor-tip">像编辑题解和游记一样，直接在前端整理知识笔记。</p>
      </div>
      <div class="card-actions">
        <button v-if="!hasImportedDp" class="btn btn-ghost" type="button" @click="importDpKnowledge">
          导入 DP 优化专题
        </button>
        <button class="btn btn-primary" type="button" @click="createKnowledge">{{ template.newTitle }}</button>
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

    <p v-if="loadError" class="auth-error" role="alert">{{ loadError }}</p>
    <p v-else-if="loading" class="comment-status">正在读取知识学习…</p>

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
            <p class="solution-title">{{ item.title || template.untitled }}</p>
            <p class="solution-meta">更新时间：{{ formatTime(item.updatedAt) }}</p>
            <p class="solution-url">阅读链接：{{ READ_PATH(item.id) }}</p>
          </div>
          <div class="card-actions">
            <RouterLink class="btn btn-ghost" :to="READ_PATH(item.id)">预览</RouterLink>
            <RouterLink class="btn btn-ghost" :to="EDIT_PATH(item.id)">编辑</RouterLink>
            <button class="btn btn-danger" type="button" @click="removeById(item.id)">删除</button>
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
            <p class="solution-title">{{ item.title || template.untitled }}</p>
            <p class="solution-meta">
              发布时间：{{ formatTime(item.publishedAt) }} · 更新时间：{{ formatTime(item.updatedAt) }}
            </p>
            <p class="solution-url">阅读链接：{{ READ_PATH(item.id) }}</p>
          </div>
          <div class="card-actions">
            <RouterLink class="btn btn-ghost" :to="READ_PATH(item.id)">阅读</RouterLink>
            <RouterLink class="btn btn-ghost" :to="EDIT_PATH(item.id)">编辑</RouterLink>
            <button class="btn btn-danger" type="button" @click="removeById(item.id)">删除</button>
          </div>
        </article>
      </div>
      <p v-else class="empty-hint">{{ template.emptyPublished }}</p>
    </section>

    <div v-if="emptyHint" class="empty-state">
      {{ emptyHint }}
      <template v-if="!hasImportedDp">可先导入上方「动态规划优化方法」专题。</template>
    </div>
  </main>
</template>
