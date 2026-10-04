import { computed, getCurrentInstance, onMounted, ref } from "vue";
import {
  ALL,
  SEARCH_FIELDS,
  SORT_OPTIONS,
  collectTags,
  filterPosts,
  sortPosts,
} from "../utils/postFilter.js";
import { loadPosts } from "../utils/postStore.js";

/**
 * 公开归档页（题解 / 知识学习）的共享状态。
 *
 * 两个归档页原先各写了一份「拉取已发布文章 → 按类型与状态过滤 → 按发布时间排序
 * → 收集标签 → 关键词+标签筛选」，差异只在文案与卡片模板，这里收敛成一处。
 *
 * @param {object} options
 * @param {string} options.kind        文章类型（POST_KIND）
 * @param {string} [options.sortMode]  排序方式，默认按发布时间倒序
 * @param {string} [options.loadErrorText] 回源失败时的提示文案
 * @param {(posts: object[]) => object[]} [options.transform] 排序前对结果做加工
 * @param {(error: Error, helpers: { setPosts: (posts: object[]) => void }) => void} [options.onError]
 *        回源失败时的兜底钩子，例如知识页要保证内置文档始终可见
 */
export function usePostArchive({
  kind,
  sortMode = SORT_OPTIONS.published,
  loadErrorText = "读取文章失败",
  transform,
  onError,
} = {}) {
  const posts = ref([]);
  const loading = ref(true);
  const loadError = ref("");
  const keyword = ref("");
  const selectedTag = ref(ALL);

  async function load() {
    loading.value = true;
    loadError.value = "";
    try {
      const published = await loadPosts({ includeDrafts: false });
      let list = published.filter(
        (post) => post.kind === kind && post.status === "published"
      );
      if (transform) list = transform(list);
      posts.value = sortPosts(list, sortMode);
    } catch (error) {
      posts.value = [];
      loadError.value = error?.message || loadErrorText;
      onError?.(error, { setPosts: (next) => { posts.value = next; } });
    } finally {
      loading.value = false;
    }
  }

  const allTags = computed(() => collectTags(posts.value));

  const filteredPosts = computed(() =>
    filterPosts(posts.value, {
      keyword: keyword.value,
      tag: selectedTag.value,
      searchFields: SEARCH_FIELDS.archive,
    })
  );

  function resetFilters() {
    keyword.value = "";
    selectedTag.value = ALL;
  }

  // 在组件里自动加载；组件外（单测）由调用方显式 await load()。
  if (getCurrentInstance()) onMounted(load);

  return {
    posts,
    loading,
    loadError,
    keyword,
    selectedTag,
    allTags,
    filteredPosts,
    load,
    resetFilters,
  };
}
