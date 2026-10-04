<script setup>
import { POST_KIND } from "../utils/postStorage";
import ArchiveCard from "../components/ArchiveCard.vue";
import { usePostArchive } from "../composables/usePostArchive";
import { ALL } from "../utils/postFilter";

const {
  posts,
  loading,
  loadError,
  keyword,
  selectedTag,
  allTags,
  filteredPosts,
  load,
} = usePostArchive({ kind: POST_KIND.solution, loadErrorText: "读取题解失败" });
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
      <button class="btn btn-primary" type="button" @click="load">重新加载</button>
    </section>
    <section v-else-if="loading" class="archive-grid" aria-label="正在加载题解">
      <article v-for="item in 3" :key="item" class="solution-archive-card archive-card-skeleton"></article>
    </section>
    <section v-else-if="filteredPosts.length" class="archive-grid">
      <ArchiveCard
        v-for="item in filteredPosts"
        :key="item.id"
        :post="item"
        :read-path="`/posts/${item.id}`"
        read-label="阅读题解"
        @select-tag="selectedTag = $event"
      />
    </section>
    <section v-else class="empty-state archive-state">
      <p>{{ posts.length ? "没有匹配当前条件的题解。" : "题解正在整理中，稍后再来看看。" }}</p>
      <button v-if="posts.length" class="btn btn-ghost" type="button" @click="keyword = ''; selectedTag = ALL">
        清空筛选
      </button>
    </section>
  </main>
</template>
