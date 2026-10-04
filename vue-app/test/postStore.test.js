import test from "node:test";
import assert from "node:assert/strict";
import { computed, effectScope, nextTick } from "vue";

// postStorage 在 Supabase 未配置时会回落到 localStorage，测试里验证的就是这条分支。
globalThis.localStorage = {
  0: undefined,
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {},
  clear() {},
};

if (!globalThis.crypto) globalThis.crypto = {};
if (!globalThis.crypto.randomUUID) {
  let counter = 0;
  globalThis.crypto.randomUUID = () => `00000000-0000-4000-8000-${String(counter++).padStart(12, "0")}`;
}

const { setRemoteEnabled } = await import("../src/utils/supabase.js");
setRemoteEnabled(false);

const { createPost, removePost, updatePost } = await import("../src/utils/postStorage.js");
const {
  applyPostChange,
  getCacheSnapshot,
  invalidatePosts,
  loadPost,
  loadPosts,
  removePostFromCache,
  resetPostStore,
  setCacheTtl,
  subscribePosts,
  useAllPosts,
} = await import("../src/utils/postStore.js");

// ── 计数型 localStorage，用来断言「回源次数」 ──
let storedPosts = [];
let reads = 0;

function seedStore(posts) {
  storedPosts = posts.map((post) => ({ ...post }));
  reads = 0;
}

globalThis.localStorage.getItem = (key) => {
  if (key !== "usedchang-posts") return null;
  reads++;
  return JSON.stringify(storedPosts);
};
globalThis.localStorage.setItem = (key, value) => {
  if (key === "usedchang-posts") storedPosts = JSON.parse(value);
};

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** 构造一条 localStorage 里的文章记录（存储层字段名）。 */
function rawPost(overrides = {}) {
  return {
    id: overrides.id || `p-${Math.random().toString(36).slice(2)}`,
    title: "标题",
    summary: "",
    content: "# 正文",
    tags: [],
    kind: "solution",
    status: "published",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    publishedAt: 1_700_000_000_000,
    ...overrides,
  };
}

test.beforeEach(() => {
  resetPostStore();
  seedStore([]);
});

test("loadPosts caches the result and skips redundant reads", async () => {
  seedStore([rawPost({ id: "a" })]);
  const first = await loadPosts();
  const readsAfterFirst = reads;
  const second = await loadPosts();
  assert.equal(second.length, 1);
  assert.equal(reads, readsAfterFirst, "第二次调用应命中缓存，不再读存储");
  assert.deepEqual(first.map((post) => post.id), second.map((post) => post.id));
});

test("loadPosts shares one request between concurrent callers", async () => {
  seedStore([rawPost({ id: "a" }), rawPost({ id: "b" })]);
  const [a, b, c] = await Promise.all([loadPosts(), loadPosts(), loadPosts()]);
  assert.equal(reads, 1, "并发调用应合并为一次回源");
  assert.equal(a.length, 2);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
});

test("force bypasses the cache; TTL expiry triggers a reload", async () => {
  seedStore([rawPost({ id: "a" })]);
  await loadPosts();
  const readsAfterFirst = reads;

  await loadPosts({ force: true });
  assert.equal(reads, readsAfterFirst + 1, "force 应强制回源");

  // TTL 设为 0 等同于禁用缓存。
  setCacheTtl(0);
  await loadPosts();
  assert.equal(reads, readsAfterFirst + 2);
  setCacheTtl(30_000);
});

test("drafts and published lists are cached in separate scopes", async () => {
  seedStore([
    rawPost({ id: "pub", status: "published" }),
    rawPost({ id: "draft", status: "draft" }),
  ]);
  const published = await loadPosts({ includeDrafts: false });
  const drafts = await loadPosts({ includeDrafts: true });
  assert.deepEqual(published.map((post) => post.id), ["pub"]);
  assert.deepEqual(drafts.map((post) => post.id).sort(), ["draft", "pub"]);
  assert.deepEqual(
    Object.keys(getCacheSnapshot()).sort(),
    ["drafts:meta", "published:meta"]
  );
});

test("loadPosts with content also fills the metadata scope", async () => {
  seedStore([rawPost({ id: "a" })]);
  await loadPosts({ includeContent: true });
  const snapshot = getCacheSnapshot();
  assert.equal(snapshot["published:full"][0].content, "# 正文");
  assert.equal("content" in snapshot["published:meta"][0], false, "meta 槽位不应带正文");

  const readsAfter = reads;
  const meta = await loadPosts({ includeContent: false });
  assert.equal(reads, readsAfter, "meta 槽位已被填充，无需再次回源");
  assert.equal(meta.length, 1);
});

test("invalidatePosts clears all or only the requested scope", async () => {
  seedStore([rawPost({ id: "a" })]);
  await loadPosts();
  await loadPosts({ includeDrafts: true });
  assert.equal(Object.keys(getCacheSnapshot()).length, 2);

  invalidatePosts(false);
  assert.deepEqual(Object.keys(getCacheSnapshot()), ["drafts:meta"]);

  invalidatePosts();
  assert.deepEqual(getCacheSnapshot(), {});
});

test("loadPost fetches content once, then serves later calls from the full scope", async () => {
  seedStore([rawPost({ id: "a", title: "甲" })]);
  await loadPosts({ includeDrafts: true, includeContent: false });
  const readsAfterList = reads;

  // meta 缓存不含正文，因此第一次必须回源补全。
  const post = await loadPost("a", { includeDrafts: true });
  assert.equal(post.title, "甲");
  assert.equal(reads, readsAfterList + 1, "meta 槽位无正文，需回源一次");
  assert.deepEqual(
    getCacheSnapshot()["drafts:full"].map((item) => item.id),
    ["a"]
  );

  const readsAfterFetch = reads;
  const cached = await loadPost("a", { includeDrafts: true });
  assert.equal(cached.title, "甲");
  assert.equal(reads, readsAfterFetch, "full 槽位已就绪，第二次应直接命中");
});

test("loadPost returns null for a missing post without hitting the backend twice", async () => {
  seedStore([rawPost({ id: "a" })]);
  await loadPosts();
  const readsAfterList = reads;

  const missing = await loadPost("does-not-exist");
  assert.equal(missing, null);
  assert.equal(reads, readsAfterList, "meta 槽位已知不含该 id，不应再回源");
});

test("loadPost reloads with force even when the list is cached", async () => {
  seedStore([rawPost({ id: "a", title: "旧标题" })]);
  await loadPosts();
  storedPosts[0].title = "新标题";
  const readsBefore = reads;

  const refreshed = await loadPost("a", { force: true });
  assert.equal(refreshed.title, "新标题");
  assert.ok(reads > readsBefore, "force 应绕过缓存回源");
});

test("applyPostChange merges a write into existing scopes", async () => {
  seedStore([rawPost({ id: "a", title: "旧" })]);
  await loadPosts({ includeContent: true });

  applyPostChange({ ...rawPost({ id: "a", title: "新" }), content: "# 新正文" });

  const snapshot = getCacheSnapshot();
  assert.equal(snapshot["published:full"][0].title, "新");
  assert.equal(snapshot["published:meta"][0].title, "新");
  assert.equal("content" in snapshot["published:meta"][0], false);
});

test("applyPostChange keeps drafts out of the published scope", async () => {
  seedStore([
    rawPost({ id: "pub", title: "已发布", status: "published" }),
    rawPost({ id: "draft", title: "已有草稿", status: "draft" }),
  ]);
  // 先填公开槽位，再填草稿槽位，两份缓存同时存在。
  await loadPosts({ includeDrafts: false, includeContent: true });
  await loadPosts({ includeDrafts: true, includeContent: true });

  applyPostChange(rawPost({ id: "new-draft", title: "新草稿", status: "draft" }));
  applyPostChange(rawPost({ id: "new-pub", title: "新发布", status: "published" }));

  const snapshot = getCacheSnapshot();
  assert.deepEqual(
    snapshot["published:meta"].map((post) => post.id).sort(),
    ["new-pub", "pub"],
    "草稿不应进入公开列表缓存"
  );
  assert.deepEqual(
    snapshot["drafts:meta"].map((post) => post.id).sort(),
    ["draft", "new-draft", "new-pub", "pub"]
  );
});

test("applyPostChange only touches scopes that are loaded", async () => {
  seedStore([rawPost({ id: "pub", status: "published" })]);
  await loadPosts({ includeContent: false });

  applyPostChange(rawPost({ id: "fresh", status: "published" }));

  const keys = Object.keys(getCacheSnapshot());
  assert.deepEqual(keys, ["published:meta"], "未加载过的槽位不应被凭空创建");
});

test("applyPostChange inserts a brand new post at the front", async () => {
  seedStore([rawPost({ id: "a" })]);
  await loadPosts();
  applyPostChange(rawPost({ id: "new", title: "新文章" }));
  assert.deepEqual(
    getCacheSnapshot()["published:meta"].map((post) => post.id),
    ["new", "a"]
  );
});

test("removePostFromCache drops the post from every scope", async () => {
  seedStore([rawPost({ id: "a" }), rawPost({ id: "b" })]);
  await loadPosts({ includeContent: true });
  removePostFromCache("a");
  const snapshot = getCacheSnapshot();
  assert.deepEqual(snapshot["published:full"].map((post) => post.id), ["b"]);
  assert.deepEqual(snapshot["published:meta"].map((post) => post.id), ["b"]);
});

test("useAllPosts is reactive to cache mutations", async () => {
  seedStore([rawPost({ id: "a" })]);
  const scope = effectScope();
  const posts = scope.run(() => useAllPosts({ includeDrafts: true }));
  const titles = computed(() => posts.value.map((post) => post.title));

  assert.deepEqual(titles.value, []);

  await loadPosts({ includeDrafts: true });
  await nextTick();
  assert.deepEqual(titles.value, ["标题"]);

  applyPostChange(rawPost({ id: "a", title: "改过的标题" }));
  await nextTick();
  assert.deepEqual(titles.value, ["改过的标题"]);

  removePostFromCache("a");
  await nextTick();
  assert.deepEqual(titles.value, []);

  scope.stop();
});

test("subscribePosts notifies on invalidation and unsubscribes cleanly", () => {
  let calls = 0;
  const unsubscribe = subscribePosts(() => {
    calls++;
  });
  invalidatePosts();
  assert.equal(calls, 1);
  unsubscribe();
  invalidatePosts();
  assert.equal(calls, 1, "取消订阅后不应再收到通知");
});

test("createPost writes through localStorage and updatePost keeps fields intact", async () => {
  const created = await createPost({ kind: "solution" });
  assert.equal(created.kind, "solution");
  assert.equal(created.status, "draft");
  assert.equal(created.title, "新建题解");
  assert.match(created.content, /^# 新建题解/);

  const updated = await updatePost(created.id, { title: "改标题" });
  assert.equal(updated.title, "改标题");
  assert.equal(updated.content, created.content, "未传 content 时不应清空正文");

  const reloaded = await loadPosts({ includeDrafts: true, force: true });
  assert.equal(reloaded.find((post) => post.id === created.id).title, "改标题");

  await removePost(created.id);
  const afterDelete = await loadPosts({ includeDrafts: true, force: true });
  assert.equal(afterDelete.length, 0);
});

test("each post kind gets its own draft template", async () => {
  const journal = await createPost({ kind: "journal" });
  const knowledge = await createPost({ kind: "knowledge" });
  assert.equal(journal.title, "新建游记");
  assert.match(journal.content, /^# 游记标题/);
  assert.equal(knowledge.title, "新建知识学习");
  assert.match(knowledge.content, /^# 知识学习标题/);

  // 未知类型回退到题解模板。
  const fallback = await createPost({ kind: "unknown" });
  assert.equal(fallback.kind, "solution");
  assert.equal(fallback.title, "新建题解");
});

test("local writes survive a JSON round trip through the store cache", async () => {
  seedStore([
    rawPost({ id: "a", tags: "图论, DP", status: "published" }),
  ]);
  const posts = await loadPosts();
  assert.deepEqual(posts[0].tags, ["图论", "DP"], "字符串标签应被规范化成数组");
  assert.equal(posts[0].createdAt > 0, true);
  assert.deepEqual(jsonClone(posts), posts, "缓存内容应可安全序列化");
});
