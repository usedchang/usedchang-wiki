import { computed, reactive } from "vue";
import { getAllPosts as fetchAllPosts, getPostById as fetchPostById } from "./postStorage.js";

/**
 * 文章数据层：在 postStorage 之上提供
 *
 *  1. 进程内缓存（默认 30s TTL），避免每次路由切换都打一次 Supabase；
 *  2. 并发去重 —— 同一份数据同时被多个视图请求时只发一次网络请求；
 *  3. 变更失效 —— 任何写操作立即让相关缓存失效并通知订阅者；
 *  4. 响应式读取 —— 缓存是 reactive 的，写操作后视图自动同步。
 *
 * 视图层不应再直接调用 postStorage，统一走这里。
 */

export const DEFAULT_CACHE_TTL = 30_000;

/** scope = 草稿可见性 × 是否带正文，共四种缓存槽位。 */
export const CACHE_SCOPES = Object.freeze({
  publishedMeta: "published:meta",
  publishedFull: "published:full",
  draftsMeta: "drafts:meta",
  draftsFull: "drafts:full",
});

const VISIBILITIES = ["published", "drafts"];
const CONTENT_MODES = ["meta", "full"];

const entries = reactive({});
const listeners = new Set();
const inflight = new Map();

let cacheTtl = DEFAULT_CACHE_TTL;

function visibilityKey(includeDrafts) {
  return includeDrafts ? "drafts" : "published";
}

function contentKey(includeContent) {
  return includeContent ? "full" : "meta";
}

function scopeKey(includeDrafts, includeContent) {
  return `${visibilityKey(includeDrafts)}:${contentKey(includeContent)}`;
}

/** 遍历全部槽位键，可选过滤。 */
function eachScopeKey(visit, predicate) {
  for (const visibility of VISIBILITIES) {
    for (const content of CONTENT_MODES) {
      const key = `${visibility}:${content}`;
      if (!predicate || predicate(key, visibility, content)) visit(key);
    }
  }
}

function isFresh(entry) {
  if (entry?.posts == null) return false;
  // ttl <= 0 表示禁用缓存，每次读取都回源。
  return cacheTtl > 0 && Date.now() - entry.fetchedAt < cacheTtl;
}

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn("postStore 订阅者回调失败", error);
    }
  }
}

function dropScopes(predicate) {
  for (const key of Object.keys(entries)) {
    if (predicate(key)) delete entries[key];
  }
}

/** 让缓存失效。传 includeDrafts 时只失效对应的一份，不传则清空全部。 */
export function invalidatePosts(includeDrafts = null) {
  if (includeDrafts === null) {
    dropScopes(() => true);
  } else {
    const prefix = includeDrafts ? "drafts:" : "published:";
    dropScopes((key) => key.startsWith(prefix));
  }
  notify();
}

/** 订阅缓存变化（写操作与手动失效都会触发）。返回取消订阅函数。 */
export function subscribePosts(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 测试用：清空缓存与并发状态。 */
export function resetPostStore({ ttl = DEFAULT_CACHE_TTL } = {}) {
  dropScopes(() => true);
  inflight.clear();
  cacheTtl = ttl;
  notify();
}

/** 测试用：固定缓存 TTL，传 0 可让每次读取都回源。 */
export function setCacheTtl(ttl) {
  cacheTtl = Number.isFinite(ttl) ? ttl : DEFAULT_CACHE_TTL;
}

/** 去掉正文，用于写入 meta 槽位。 */
function toMeta(post) {
  const { content: _content, ...meta } = post;
  return meta;
}

/** 把一篇文章合并进指定槽位；该槽位未加载过则跳过。 */
function mergeIntoScope(key, post, withContent) {
  const cached = entries[key];
  if (!cached?.posts) return;
  const value = withContent ? post : toMeta(post);
  const next = [...cached.posts];
  const index = next.findIndex((item) => item.id === post.id);
  if (index >= 0) next[index] = { ...next[index], ...value };
  else next.unshift(value);
  entries[key] = { posts: next, fetchedAt: Date.now() };
}

/**
 * 选择一次写入应更新的槽位。
 * - 合并（merge）：草稿槽位总能看到全部文章；已发布槽位只在文章确实已发布时才更新，
 *   避免草稿泄漏到公开列表。
 * - 删除（remove）：该文章已从后端消失，所有可见性下都应移除。
 * - 单篇详情（seed）：只有发起请求的那个可见性可以补建槽位，不把草稿写进公开缓存。
 */
function visitAffectedScopes(post, { remove = false, seedVisibility = null } = {}) {
  const isPublished = post?.status === "published";
  const update = (key) => {
    if (remove) dropFromScope(key, post.id);
    else mergeIntoScope(key, post, key.endsWith(":full"));
  };

  if (remove) {
    eachScopeKey(update);
    return;
  }

  if (seedVisibility) {
    const fullKey = `${seedVisibility}:full`;
    const metaKey = `${seedVisibility}:meta`;
    // 详情请求返回的一定是完整文档，可以直接补建 full 槽位。
    entries[fullKey] = { posts: [post], fetchedAt: Date.now() };
    // meta 槽位只做增量合并：它已加载过时说明列表数据更全，不该被单篇覆盖。
    if (entries[metaKey]?.posts) mergeIntoScope(metaKey, post, false);
    return;
  }

  eachScopeKey(update, (_key, visibility) => visibility === "drafts" || isPublished);
}

function dropFromScope(key, id) {
  const cached = entries[key];
  if (!cached?.posts) return;
  entries[key] = {
    posts: cached.posts.filter((post) => post.id !== id),
    fetchedAt: Date.now(),
  };
}

/**
 * 读取文章列表。命中新鲜缓存直接返回，否则回源；并发调用共享同一次请求。
 * includeContent 为 true 时会同时填充 meta 槽位，省掉列表页的一次往返。
 */
export async function loadPosts({ includeDrafts = false, includeContent = false, force = false } = {}) {
  const key = scopeKey(includeDrafts, includeContent);
  if (!force) {
    const cached = entries[key];
    if (isFresh(cached)) return cached.posts;
    if (inflight.has(key)) return inflight.get(key);
  }

  const request = (async () => {
    const posts = await fetchAllPosts({ includeDrafts, includeContent });
    entries[key] = { posts, fetchedAt: Date.now() };
    if (includeContent) {
      const metaKey = scopeKey(includeDrafts, false);
      if (force || !isFresh(entries[metaKey])) {
        entries[metaKey] = { posts: posts.map(toMeta), fetchedAt: Date.now() };
      }
    }
    notify();
    return posts;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, request);
  return request;
}

/** 读取单篇详情。优先复用已缓存的列表，未命中再回源。 */
export async function loadPost(id, { includeDrafts = false, force = false } = {}) {
  if (!id) return null;

  const fullKey = scopeKey(includeDrafts, true);
  const metaKey = scopeKey(includeDrafts, false);

  if (!force) {
    const full = entries[fullKey];
    if (isFresh(full)) {
      const hit = full.posts.find((post) => post.id === id);
      if (hit) return hit;
    }
    const meta = entries[metaKey];
    if (isFresh(meta)) {
      const hit = meta.posts.find((post) => post.id === id);
      // meta 槽位没有正文，命中后仍要回源补全；但槽位已确认不含该 id 时可直接判空。
      if (!hit) return null;
    }
  }

  const post = await fetchPostById(id, { includeDrafts });
  if (!post) return null;
  visitAffectedScopes(post, { seedVisibility: visibilityKey(includeDrafts) });
  notify();
  return post;
}

/** 把一次写入的结果合并进缓存，避免写后立刻全量回源。 */
export function applyPostChange(post) {
  if (!post?.id) return;
  visitAffectedScopes(post);
  notify();
}

/** 从缓存中移除一篇文章（删除后调用）。 */
export function removePostFromCache(id) {
  if (!id) return;
  visitAffectedScopes({ id }, { remove: true });
  notify();
}

/**
 * 全站文章的响应式只读视图。因为读取的是 reactive 缓存，
 * 任何写操作之后依赖它的 computed 都会自动重算。
 */
export function useAllPosts({ includeDrafts = false, includeContent = false } = {}) {
  const key = scopeKey(includeDrafts, includeContent);
  return computed(() => entries[key]?.posts ?? []);
}

/** 只读缓存快照，供调试与测试断言。 */
export function getCacheSnapshot() {
  return Object.fromEntries(
    Object.entries(entries).map(([key, entry]) => [key, entry?.posts ?? null])
  );
}
