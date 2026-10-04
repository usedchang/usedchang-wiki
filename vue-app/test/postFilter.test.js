import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL,
  SEARCH_FIELDS,
  SORT_OPTIONS,
  collectTags,
  filterPosts,
  findAdjacentPosts,
  formatDate,
  formatDateTime,
  groupByStatus,
  sortPosts,
  toDateTimeAttr,
} from "../src/utils/postFilter.js";

const makePost = (overrides = {}) => ({
  id: overrides.id || Math.random().toString(36).slice(2),
  title: "未命名",
  summary: "",
  content: "",
  tags: [],
  status: "draft",
  updatedAt: 0,
  publishedAt: null,
  ...overrides,
});

test("sortPosts orders by update time descending without mutating input", () => {
  const posts = [
    makePost({ id: "old", updatedAt: 100 }),
    makePost({ id: "new", updatedAt: 300 }),
    makePost({ id: "mid", updatedAt: 200 }),
  ];
  const sorted = sortPosts(posts, SORT_OPTIONS.updated);
  assert.deepEqual(sorted.map((post) => post.id), ["new", "mid", "old"]);
  assert.deepEqual(posts.map((post) => post.id), ["old", "new", "mid"], "入参不应被排序修改");
});

test("sortPosts by publishedAt falls back to updatedAt for drafts", () => {
  const posts = [
    makePost({ id: "draft", updatedAt: 500, publishedAt: null }),
    makePost({ id: "published", updatedAt: 100, publishedAt: 200 }),
  ];
  const sorted = sortPosts(posts, SORT_OPTIONS.published);
  assert.deepEqual(sorted.map((post) => post.id), ["draft", "published"]);
});

test("sortPosts keeps a stable order for identical timestamps", () => {
  const posts = [
    makePost({ id: "b", title: "B 题", updatedAt: 100 }),
    makePost({ id: "a", title: "A 题", updatedAt: 100 }),
  ];
  assert.deepEqual(sortPosts(posts).map((post) => post.id), ["a", "b"]);
});

test("collectTags trims, dedupes and sorts tags", () => {
  const tags = collectTags([
    makePost({ tags: ["图论", " dp ", "图论"] }),
    makePost({ tags: ["DP", "", null, "数学"] }),
  ]);
  assert.deepEqual(tags, ["dp", "DP", "数学", "图论"].sort((a, b) => a.localeCompare(b, "zh-CN")));
  assert.equal(tags.filter((tag) => tag.toLowerCase() === "dp").length, 2, "大小写不同视为不同标签");
});

test("collectTags tolerates posts without a tags array", () => {
  assert.deepEqual(collectTags([makePost({ tags: undefined }), null]), []);
});

test("filterPosts matches keyword against the configured fields only", () => {
  const posts = [
    makePost({ id: "hit-summary", title: "第一篇", summary: "讲线段树合并" }),
    makePost({ id: "hit-tags", title: "第二篇", tags: ["网络流"] }),
    makePost({ id: "miss", title: "第三篇", summary: "", tags: [] }),
  ];

  const titleOnly = filterPosts(posts, { keyword: "线段树", searchFields: SEARCH_FIELDS.title });
  assert.deepEqual(titleOnly.map((post) => post.id), [], "标题模式不应命中摘要");

  const archive = filterPosts(posts, { keyword: "线段树", searchFields: SEARCH_FIELDS.archive });
  assert.deepEqual(archive.map((post) => post.id), ["hit-summary"]);

  const byTag = filterPosts(posts, { keyword: "网络流", searchFields: SEARCH_FIELDS.archive });
  assert.deepEqual(byTag.map((post) => post.id), ["hit-tags"]);
});

test("filterPosts keyword search is case-insensitive and locale aware", () => {
  const posts = [makePost({ id: "a", title: "Codeforces Round 1000" })];
  assert.equal(filterPosts(posts, { keyword: "CODEFORCES" }).length, 1);
  assert.equal(filterPosts(posts, { keyword: "  round  " }).length, 1);
});

test("filterPosts applies tag and status filters together", () => {
  const posts = [
    makePost({ id: "draft-dp", tags: ["dp"], status: "draft" }),
    makePost({ id: "pub-dp", tags: ["dp"], status: "published" }),
    makePost({ id: "pub-graph", tags: ["图论"], status: "published" }),
  ];
  assert.deepEqual(
    filterPosts(posts, { tag: "dp", status: "published" }).map((post) => post.id),
    ["pub-dp"]
  );
  assert.deepEqual(
    filterPosts(posts, { tag: ALL, status: ALL }).map((post) => post.id),
    ["draft-dp", "pub-dp", "pub-graph"]
  );
  assert.deepEqual(
    filterPosts(posts, { tag: "不存在的标签" }).map((post) => post.id),
    []
  );
});

test("groupByStatus splits drafts from published", () => {
  const { drafts, published } = groupByStatus([
    makePost({ id: "a", status: "draft" }),
    makePost({ id: "b", status: "published" }),
    makePost({ id: "c" }),
  ]);
  assert.deepEqual(drafts.map((post) => post.id), ["a", "c"], "缺少 status 视为草稿");
  assert.deepEqual(published.map((post) => post.id), ["b"]);
});

test("findAdjacentPosts picks the nearest earlier and later neighbours", () => {
  const posts = [
    makePost({ id: "t100", publishedAt: 100 }),
    makePost({ id: "t300", publishedAt: 300 }),
    makePost({ id: "t200", publishedAt: 200 }),
    makePost({ id: "t400", publishedAt: 400 }),
  ];
  const { previous, next } = findAdjacentPosts(posts, makePost({ id: "t300", publishedAt: 300 }));
  assert.equal(previous.id, "t200", "上一篇应是时间上更早且最近的一篇");
  assert.equal(next.id, "t400", "下一篇应是时间上更晚且最近的一篇");
});

test("findAdjacentPosts returns null at the ends of the list", () => {
  const posts = [
    makePost({ id: "first", publishedAt: 100 }),
    makePost({ id: "last", publishedAt: 200 }),
  ];
  const atFirst = findAdjacentPosts(posts, makePost({ id: "first", publishedAt: 100 }));
  assert.equal(atFirst.previous, null);
  assert.equal(atFirst.next.id, "last");

  const atLast = findAdjacentPosts(posts, makePost({ id: "last", publishedAt: 200 }));
  assert.equal(atLast.previous.id, "first");
  assert.equal(atLast.next, null);
});

test("findAdjacentPosts never returns the current post itself", () => {
  const current = makePost({ id: "self", publishedAt: 200 });
  const { previous, next } = findAdjacentPosts([current], current);
  assert.equal(previous, null);
  assert.equal(next, null);
});

test("findAdjacentPosts falls back to updatedAt for entries without publishedAt", () => {
  const posts = [
    makePost({ id: "draft-ish", publishedAt: null, updatedAt: 500 }),
    makePost({ id: "older", publishedAt: 100 }),
  ];
  const { previous, next } = findAdjacentPosts(
    posts,
    makePost({ id: "mid", publishedAt: 300 })
  );
  assert.equal(previous.id, "older");
  assert.equal(next.id, "draft-ish", "没有 publishedAt 的文章应回落到 updatedAt 参与比较");
});

test("findAdjacentPosts tolerates empty input and a missing current post", () => {
  assert.deepEqual(findAdjacentPosts([], null), { previous: null, next: null });
  assert.deepEqual(findAdjacentPosts(null, makePost({})), { previous: null, next: null });
  assert.deepEqual(
    findAdjacentPosts([makePost({ id: "a", publishedAt: 100 })], null),
    { previous: null, next: null }
  );
});

test("findAdjacentPosts ignores entries with no usable timestamp", () => {
  const posts = [
    makePost({ id: "untimed", publishedAt: null, updatedAt: 0 }),
    makePost({ id: "timed", publishedAt: 100 }),
  ];
  const { previous, next } = findAdjacentPosts(posts, makePost({ id: "cur", publishedAt: 0 }));
  assert.equal(previous, null, "时间戳为 0 的文章不应被当作「更早」的邻居");
  assert.equal(next.id, "timed");
});

test("time formatters handle missing and invalid values", () => {
  assert.equal(formatDateTime(null), "未知时间");
  assert.equal(formatDateTime("not-a-date"), "未知时间");
  assert.equal(formatDate(undefined), "日期未知");
  assert.equal(toDateTimeAttr(null), undefined);
  assert.equal(toDateTimeAttr("nope"), undefined);
  assert.equal(toDateTimeAttr(0), undefined);
  assert.match(toDateTimeAttr(Date.UTC(2026, 0, 2)), /^2026-01-02T00:00:00\.000Z$/);
});
