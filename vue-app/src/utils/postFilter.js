/**
 * 文章筛选 / 排序 / 分组的纯函数实现。
 *
 * 抽出来的理由：这些逻辑原本在 SolutionArchiveView、KnowledgeArchiveView、
 * SolutionListView、JournalListView、KnowledgeListView 里各写了一遍，行为还不一致
 * （有的只搜标题，有的搜标题+摘要+标签；标签排序某处按插入序、某处按拼音）。
 * 纯函数无副作用，便于单测覆盖。
 */

export const ALL = "all";

/** 编辑器列表页默认搜索标题；归档页搜索标题 + 摘要 + 标签。 */
export const SEARCH_FIELDS = Object.freeze({
  title: ["title"],
  archive: ["title", "summary", "tags"],
  full: ["title", "summary", "content", "tags"],
});

export const SORT_OPTIONS = Object.freeze({
  updated: "updatedAt-desc",
  published: "publishedAt-desc",
});

function toComparableText(value, locale) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((item) => toComparableText(item, locale)).join("\n");
  return String(value).toLocaleLowerCase(locale);
}

function postSortStamp(post, mode) {
  if (mode === SORT_OPTIONS.published) {
    return post.publishedAt || post.updatedAt || 0;
  }
  return post.updatedAt || post.publishedAt || 0;
}

/** 按更新时间或发布时间倒序排列，返回新数组，不改动入参。 */
export function sortPosts(posts, mode = SORT_OPTIONS.updated, locale = "zh-CN") {
  return [...(posts || [])].sort((a, b) => {
    const delta = postSortStamp(b, mode) - postSortStamp(a, mode);
    if (delta !== 0) return delta;
    // 时间相同时用标题稳定排序，避免列表顺序在多次渲染间跳动。
    return String(a?.title || "").localeCompare(String(b?.title || ""), locale);
  });
}

/** 收集去重后的标签，默认按语言环境排序。 */
export function collectTags(posts, { locale = "zh-CN", sorted = true } = {}) {
  const tags = new Set();
  for (const post of posts || []) {
    if (!Array.isArray(post?.tags)) continue;
    for (const tag of post.tags) {
      const text = String(tag ?? "").trim();
      if (text) tags.add(text);
    }
  }
  const list = [...tags];
  return sorted ? list.sort((a, b) => a.localeCompare(b, locale)) : list;
}

/**
 * 按关键词 / 标签 / 状态筛选文章。
 *
 * @param {object[]} posts
 * @param {object} options
 * @param {string} [options.keyword]      关键词，空串表示不筛选
 * @param {string} [options.tag]          标签，`ALL` 表示不筛选
 * @param {string} [options.status]       状态，`ALL` 表示不筛选
 * @param {string[]} [options.searchFields] 参与搜索的字段，默认标题 + 摘要 + 标签
 * @param {string} [options.locale]
 */
export function filterPosts(posts, options = {}) {
  const {
    keyword = "",
    tag = ALL,
    status = ALL,
    searchFields = SEARCH_FIELDS.archive,
    locale = "zh-CN",
  } = options;

  const needle = toComparableText(keyword, locale).trim();
  const fields = Array.isArray(searchFields) && searchFields.length ? searchFields : SEARCH_FIELDS.archive;

  return (posts || []).filter((post) => {
    if (!post) return false;
    if (status !== ALL && post.status !== status) return false;

    const postTags = Array.isArray(post.tags) ? post.tags : [];
    if (tag !== ALL && !postTags.includes(tag)) return false;

    if (!needle) return true;
    return fields.some((field) => toComparableText(post[field], locale).includes(needle));
  });
}

/** 拆成「草稿 / 已发布」两组，供管理页分区展示。 */
export function groupByStatus(posts) {
  const drafts = [];
  const published = [];
  for (const post of posts || []) {
    if (post?.status === "published") published.push(post);
    else drafts.push(post);
  }
  return { drafts, published };
}

/**
 * 找出阅读页「上一篇 / 下一篇」。
 *
 * 以当前文章的发布时间为基准，在候选集里取时间上紧邻的前后各一篇。
 * 草稿等没有 publishedAt 的文章回落到 updatedAt，避免它们永远被排除。
 *
 * @param {object[]} posts 候选文章（通常已按类型过滤）
 * @param {object} current 当前文章
 * @returns {{ previous: object|null, next: object|null }}
 *          previous 是更早的一篇，next 是更晚的一篇
 */
export function findAdjacentPosts(posts, current) {
  if (!current) return { previous: null, next: null };

  const stamp = (post) => post?.publishedAt || post?.updatedAt || 0;
  const currentStamp = stamp(current);

  let previous = null;
  let next = null;
  for (const post of posts || []) {
    if (!post || post.id === current.id) continue;
    const value = stamp(post);
    if (value < currentStamp) {
      if (!previous || value > stamp(previous)) previous = post;
    } else if (value > currentStamp) {
      if (!next || value < stamp(next)) next = post;
    }
  }
  return { previous, next };
}

/** 管理页与归档页共用的时间格式化。 */
export function formatDateTime(timestamp, { locale = "zh-CN", fallback = "未知时间" } = {}) {
  if (!timestamp) return fallback;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleString(locale, { hour12: false });
}

/** 归档页只显示日期。 */
export function formatDate(timestamp, { locale = "zh-CN", fallback = "日期未知" } = {}) {
  if (!timestamp) return fallback;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

/** `<time datetime>` 用的 ISO 值，无效时间返回 undefined。 */
export function toDateTimeAttr(timestamp) {
  if (!timestamp) return undefined;
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/** 归档卡片统一用「发布时间，缺失时回落到更新时间」。 */
export function formatPostDate(post, options) {
  return formatDate(post?.publishedAt || post?.updatedAt, options);
}

/** 归档卡片的时间属性同样使用回落后得到的时间戳。 */
export function toPostDateTimeAttr(post) {
  return toDateTimeAttr(post?.publishedAt || post?.updatedAt);
}
