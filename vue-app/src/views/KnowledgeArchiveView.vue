<script setup>
import { POST_KIND } from "../utils/postStorage";
import ArchiveCard from "../components/ArchiveCard.vue";
import { usePostArchive } from "../composables/usePostArchive";
import { SORT_OPTIONS } from "../utils/postFilter";
import {
  DP_KNOWLEDGE_ARTICLE,
  DP_KNOWLEDGE_SOURCE,
  isDpKnowledgePost,
} from "../content/dp-optimization";

/**
 * 内置 Markdown 文档没有入库，若文章库里没有对应文章就补在最前面。
 * 它没有 publishedAt，所以用一个极大的 updatedAt 让它稳定排在首位。
 */
function pinBuiltinFirst(list) {
  if (list.some(isDpKnowledgePost)) return list;
  return [{ ...DP_KNOWLEDGE_ARTICLE, updatedAt: Number.MAX_SAFE_INTEGER }, ...list];
}

const {
  posts,
  loading,
  loadError,
  keyword,
  selectedTag,
  allTags,
  filteredPosts,
  load,
  resetFilters,
} = usePostArchive({
  kind: POST_KIND.knowledge,
  loadErrorText: "读取知识学习失败",
  // updatedAt 排序：其余文章回落到自己的发布时间，内置文档恒在最前。
  sortMode: SORT_OPTIONS.updated,
  transform: pinBuiltinFirst,
  onError: (_error, { setPosts }) => {
    // 远端 posts 表尚未建好时，内置文档仍应可发现；管理员修好连接或导入后即可正常展示。
    setPosts([{ ...DP_KNOWLEDGE_ARTICLE, updatedAt: Number.MAX_SAFE_INTEGER }]);
  },
});

function readPath(post) {
  return isDpKnowledgePost(post) ? "/knowledge/dp-optimization" : `/posts/${post.id}`;
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
        <RouterLink class="btn btn-ghost" to="/knowledge/dp-optimization">查看 DP 优化专题</RouterLink>
      </div>
    </header>

    <p v-if="loadError" class="auth-error archive-load-warning" role="alert">
      {{ loadError }}；当前显示内置 DP 优化文档。<button class="btn btn-ghost btn-sm" type="button" @click="load">重新加载</button>
    </p>

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

    <section v-if="loading" class="archive-grid" aria-label="正在加载知识学习">
      <article v-for="item in 3" :key="item" class="solution-archive-card archive-card-skeleton"></article>
    </section>
    <section v-else-if="filteredPosts.length" class="archive-grid">
      <ArchiveCard
        v-for="post in filteredPosts"
        :key="post.id"
        :post="post"
        :read-path="readPath(post)"
        :meta-label="post.isBuiltin ? '内置专题' : ''"
        :hide-date="Boolean(post.isBuiltin)"
        read-label="阅读笔记"
        @select-tag="selectedTag = $event"
      >
        <template #actions>
          <RouterLink
            v-if="post.isBuiltin"
            class="archive-read-link"
            :to="{ path: '/admin/knowledge', query: { source: DP_KNOWLEDGE_SOURCE } }"
          >
            导入/编辑
          </RouterLink>
          <RouterLink
            v-else-if="isDpKnowledgePost(post)"
            class="archive-read-link"
            :to="`/admin/knowledge/${post.id}`"
          >
            编辑
          </RouterLink>
        </template>
      </ArchiveCard>
    </section>
    <section v-else class="empty-state archive-state">
      <p>没有匹配当前条件的知识笔记。</p>
      <button class="btn btn-primary" type="button" @click="resetFilters">清空筛选</button>
    </section>
  </main>
</template>
