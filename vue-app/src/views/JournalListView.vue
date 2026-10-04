<script setup>
import { useRouter } from "vue-router";
import { usePostList } from "../composables/usePostList";
import { createPost, POST_KIND } from "../utils/postStorage";
import { pushToast } from "../utils/toast";

const router = useRouter();

const {
  template,
  loading,
  loadError,
  keyword,
  selectedTag,
  selectedStatus,
  sortBy,
  filteredPosts,
  draftPosts,
  publishedPosts,
  allTags,
  emptyHint,
  resetFilters,
  removeById,
  rememberCreated,
  formatTime,
} = usePostList({ kind: POST_KIND.journal });

const READ_PATH = (id) => `/posts/${id}`;
const EDIT_PATH = (id) => `/admin/journal/${id}`;

async function createJournal() {
  try {
    const post = await createPost({ kind: POST_KIND.journal });
    rememberCreated(post);
    pushToast(template.value.newToast, "success");
    router.push(EDIT_PATH(post.id));
  } catch (error) {
    pushToast(error?.message || template.value.createError, "error", 3200);
  }
}
</script>

<template>
  <main class="container section solution-list-page journal-list-page">
    <div class="section-title-row">
      <h1>{{ template.adminLabel }}</h1>
      <button class="btn btn-primary" type="button" @click="createJournal">{{ template.newTitle }}</button>
    </div>

    <p class="journal-intro panel">
      用 Markdown 写行程、心情与配图，发布后读者可在同一页面浏览全文并<strong>发表评论</strong>（与题解共用评论存储，按文章 ID 区分）。
    </p>

    <section class="panel solution-filter-panel">
      <h3 class="panel-title">快速筛选</h3>
      <div class="solution-filter-grid">
        <input v-model="keyword" placeholder="按标题搜索，如：青岛 / 三日" />
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
    <p v-else-if="loading" class="comment-status">正在读取游记…</p>

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
            <RouterLink class="btn btn-ghost" :to="READ_PATH(item.id)">阅读</RouterLink>
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

    <div v-if="emptyHint" class="empty-state">{{ emptyHint }}</div>
  </main>
</template>
