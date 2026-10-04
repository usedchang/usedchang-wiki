import test from "node:test";
import assert from "node:assert/strict";
import { computed, nextTick } from "vue";

// postStorage 在 Supabase 未配置时会回落到 localStorage，这里覆盖的正是这条分支。
globalThis.localStorage = {
  getItem: () => JSON.stringify(storedPosts),
  setItem() {},
  removeItem() {},
  clear() {},
};

let storedPosts = [];

const { setRemoteEnabled } = await import("../src/utils/supabase.js");
setRemoteEnabled(false);

const { ALL } = await import("../src/utils/postFilter.js");
const { resetPostStore } = await import("../src/utils/postStore.js");
const { usePostArchive } = await import("../src/composables/usePostArchive.js");

const DAY = 86_400_000;

function rawPost(overrides = {}) {
  return {
    id: overrides.id,
    title: overrides.title || "标题",
    summary: "",
    content: "# 正文",
    tags: [],
    kind: "solution",
    status: "published",
    created_at: new Date(1_700_000_000_000).toISOString(),
    updated_at: new Date(overrides.publishedAt ?? 1_700_000_000_000).toISOString(),
    published_at: new Date(overrides.publishedAt ?? 1_700_000_000_000).toISOString(),
    ...overrides,
  };
}

function seed(posts) {
  storedPosts = posts;
}

test.beforeEach(() => {
  resetPostStore();
  seed([]);
});

test("usePostArchive keeps only published posts of the requested kind", async () => {
  seed([
    rawPost({ id: "s1", kind: "solution", title: "题解一" }),
    rawPost({ id: "s2", kind: "solution", status: "draft", title: "题解草稿" }),
    rawPost({ id: "j1", kind: "journal", title: "游记一" }),
    rawPost({ id: "k1", kind: "knowledge", title: "知识一" }),
  ]);

  const archive = usePostArchive({ kind: "solution" });
  await archive.load();

  assert.deepEqual(archive.posts.value.map((post) => post.id), ["s1"]);
  assert.equal(archive.loading.value, false);
  assert.equal(archive.loadError.value, "");
});

test("usePostArchive sorts by publish time, newest first", async () => {
  const base = 1_700_000_000_000;
  seed([
    rawPost({ id: "older", publishedAt: base }),
    rawPost({ id: "newest", publishedAt: base + 2 * DAY }),
    rawPost({ id: "middle", publishedAt: base + DAY }),
  ]);

  const archive = usePostArchive({ kind: "solution" });
  await archive.load();

  assert.deepEqual(
    archive.posts.value.map((post) => post.id),
    ["newest", "middle", "older"]
  );
});

test("usePostArchive applies the transform hook before sorting", async () => {
  const base = 1_700_000_000_000;
  seed([rawPost({ id: "managed", publishedAt: base + DAY })]);

  const builtin = { id: "builtin", title: "内置文档", isBuiltin: true, tags: [] };
  const archive = usePostArchive({
    kind: "solution",
    transform: (list) => [builtin, ...list],
  });
  await archive.load();

  // transform 先执行，composable 再按发布时间倒序排序；
  // 内置文档没有时间戳（0），因此在发布时间排序下排到最后。
  assert.deepEqual(archive.posts.value.map((post) => post.id), ["managed", "builtin"]);
});

test("usePostArchive can pin an untimestamped entry to the top via sortMode", async () => {
  const base = 1_700_000_000_000;
  seed([
    rawPost({ id: "older", publishedAt: base }),
    rawPost({ id: "newer", publishedAt: base + DAY }),
  ]);

  // 复刻知识归档页的用法：内置文档没有 publishedAt，
  // 用极大的 updatedAt + updated 排序把它稳定钉在首位。
  const builtin = {
    id: "builtin",
    title: "内置文档",
    isBuiltin: true,
    tags: [],
    updatedAt: Number.MAX_SAFE_INTEGER,
  };
  const archive = usePostArchive({
    kind: "solution",
    sortMode: "updatedAt-desc",
    transform: (list) => [builtin, ...list],
  });
  await archive.load();

  assert.deepEqual(
    archive.posts.value.map((post) => post.id),
    ["builtin", "newer", "older"],
    "内置文档应稳定排在首位"
  );
});

test("usePostArchive collects tags and filters by keyword and tag", async () => {
  seed([
    rawPost({ id: "a", title: "最短路问题", summary: "Dijkstra", tags: ["图论", "最短路"] }),
    rawPost({ id: "b", title: "线段树合并", summary: "合并", tags: ["数据结构"] }),
  ]);

  const archive = usePostArchive({ kind: "solution" });
  await archive.load();

  assert.deepEqual(archive.allTags.value, ["图论", "最短路", "数据结构"].sort((x, y) => x.localeCompare(y, "zh-CN")));

  // 关键词命中标题
  archive.keyword.value = "最短路";
  assert.deepEqual(archive.filteredPosts.value.map((post) => post.id), ["a"]);

  // 关键词命中摘要
  archive.keyword.value = "Dijkstra";
  assert.deepEqual(archive.filteredPosts.value.map((post) => post.id), ["a"]);

  // 关键词命中标签
  archive.keyword.value = "数据结构";
  assert.deepEqual(archive.filteredPosts.value.map((post) => post.id), ["b"]);

  // 标签筛选独立于关键词
  archive.keyword.value = "";
  archive.selectedTag.value = "图论";
  assert.deepEqual(archive.filteredPosts.value.map((post) => post.id), ["a"]);

  // 恢复全部
  archive.resetFilters();
  assert.equal(archive.keyword.value, "");
  assert.equal(archive.selectedTag.value, ALL);
  assert.equal(archive.filteredPosts.value.length, 2);
});

test("usePostArchive reports load failures and runs the onError fallback", async () => {
  const seen = [];
  const archive = usePostArchive({
    kind: "solution",
    loadErrorText: "读取题解失败",
    onError: (error, { setPosts }) => {
      seen.push(error);
      setPosts([{ id: "fallback", title: "兜底文档" }]);
    },
  });

  // 打开远端分支并清空缓存，让回源必然失败；stub fetch 保证是即时的确定性失败，
  // 而不是依赖 DNS 超时。
  const { invalidatePosts, resetPostStore: reset } = await import("../src/utils/postStore.js");
  reset();
  invalidatePosts();
  setRemoteEnabled(true);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("network down"));
  try {
    await archive.load();
  } finally {
    globalThis.fetch = originalFetch;
    setRemoteEnabled(false);
  }

  assert.equal(seen.length, 1, "onError 应被调用一次");
  assert.equal(typeof archive.loadError.value, "string");
  assert.notEqual(archive.loadError.value, "", "错误文案应被设置");
  assert.deepEqual(
    archive.posts.value.map((post) => post.id),
    ["fallback"],
    "onError 的兜底内容应生效"
  );
  assert.equal(archive.loading.value, false, "失败后不应卡在加载态");
});

test("usePostArchive exposes reactive filtering that updates without reloading", async () => {
  seed([
    rawPost({ id: "a", title: "Alpha" }),
    rawPost({ id: "b", title: "Beta" }),
  ]);

  const archive = usePostArchive({ kind: "solution" });
  await archive.load();

  const titles = computed(() => archive.filteredPosts.value.map((post) => post.title));
  assert.deepEqual(titles.value, ["Alpha", "Beta"]);

  archive.keyword.value = "beta";
  await nextTick();
  assert.deepEqual(titles.value, ["Beta"]);
});
