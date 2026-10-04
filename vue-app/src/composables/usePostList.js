import { computed, getCurrentInstance, onMounted, ref } from "vue";
import {
  ALL,
  SEARCH_FIELDS,
  SORT_OPTIONS,
  collectTags,
  filterPosts,
  formatDateTime,
  groupByStatus,
  sortPosts,
} from "../utils/postFilter";
import { getPostKindTemplate, removePost } from "../utils/postStorage";
import {
  applyPostChange,
  loadPosts,
  removePostFromCache,
  useAllPosts,
} from "../utils/postStore";
import { pushToast } from "../utils/toast";

/**
 * 管理列表页的共享状态与行为。
 *
 * 原先 SolutionListView / JournalListView / KnowledgeListView 各自复制了一份
 * 「加载 → 排序 → 收集标签 → 筛选 → 草稿/已发布分组」流程（约 107 行脚本几乎完全一致），
 * 这里收敛成单一实现，视图只保留自己的模板与路由跳转。
 */
export function usePostList({
  kind,
  searchFields = SEARCH_FIELDS.title,
  defaultSort = SORT_OPTIONS.updated,
  autoLoad = true,
  confirmDelete,
} = {}) {
  const template = getPostKindTemplate(kind);

  const loading = ref(false);
  const loadError = ref("");

  const keyword = ref("");
  const selectedTag = ref(ALL);
  const selectedStatus = ref(ALL);
  const sortBy = ref(defaultSort);

  // 缓存是响应式的：写操作（新建/删除/编辑）后这里会自动更新，无需手动 refresh。
  const allPosts = useAllPosts({ includeDrafts: true });
  const posts = computed(() =>
    kind ? allPosts.value.filter((post) => post.kind === kind) : allPosts.value
  );

  const sortedPosts = computed(() => sortPosts(posts.value, sortBy.value));
  const allTags = computed(() => collectTags(sortedPosts.value));

  const filteredPosts = computed(() =>
    filterPosts(sortedPosts.value, {
      keyword: keyword.value,
      tag: selectedTag.value,
      status: selectedStatus.value,
      searchFields,
    })
  );

  const groups = computed(() => groupByStatus(filteredPosts.value));
  const draftPosts = computed(() => groups.value.drafts);
  const publishedPosts = computed(() => groups.value.published);

  const activeFilterCount = computed(
    () =>
      [keyword.value.trim(), selectedTag.value, selectedStatus.value].filter(
        (value) => value && value !== ALL
      ).length
  );
  const hasActiveFilters = computed(() => activeFilterCount.value > 0);
  const hasPosts = computed(() => posts.value.length > 0);

  /** 没有内容 / 筛选后为空 / 全部为草稿，三种情况文案不同。 */
  const emptyHint = computed(() => {
    if (!loading.value && !hasPosts.value) return template.emptyAll;
    if (hasPosts.value && !filteredPosts.value.length) return template.emptyFiltered;
    return "";
  });

  async function load({ force = false } = {}) {
    loading.value = true;
    loadError.value = "";
    try {
      await loadPosts({ includeDrafts: true, force });
    } catch (error) {
      loadError.value = error?.message || template.loadError;
    } finally {
      loading.value = false;
    }
  }

  function resetFilters() {
    keyword.value = "";
    selectedTag.value = ALL;
    selectedStatus.value = ALL;
    sortBy.value = defaultSort;
  }

  async function removeById(id, { confirmMessage } = {}) {
    const target = posts.value.find((item) => item.id === id);
    const name = target?.title || template.untitled;
    const ask = confirmDelete || ((message) => globalThis.confirm?.(message) ?? false);
    const message = confirmMessage || `确定删除“${name}”吗？`;
    if (!ask(message)) return false;
    try {
      await removePost(id);
      removePostFromCache(id, { includeDrafts: true });
      pushToast(`已删除：${name}`, "info");
      return true;
    } catch (error) {
      pushToast(error?.message || "删除失败", "error", 3200);
      return false;
    }
  }

  /** 新建成功的文章直接塞进缓存，省掉一次列表回源。 */
  function rememberCreated(post) {
    applyPostChange(post, { includeDrafts: true });
  }

  // 在组件里自动加载；组件外（单测）由调用方显式 await load()。
  if (autoLoad && getCurrentInstance()) onMounted(load);

  return {
    template,
    // 状态
    loading,
    loadError,
    keyword,
    selectedTag,
    selectedStatus,
    sortBy,
    // 数据
    posts,
    sortedPosts,
    filteredPosts,
    draftPosts,
    publishedPosts,
    allTags,
    hasActiveFilters,
    activeFilterCount,
    hasPosts,
    emptyHint,
    // 行为
    load,
    resetFilters,
    removeById,
    rememberCreated,
    // 格式化
    formatTime: (timestamp) => formatDateTime(timestamp),
  };
}
