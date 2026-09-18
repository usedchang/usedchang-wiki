import dpOptimizationMarkdown from "../knowledge/dp-optimization.md?raw";

/** @typedef {{ id: string; num: string; title: string; subtitle: string; markdown: string }} DpSection */

/** The canonical, merged source consumed by the public knowledge page. */
export const DP_KNOWLEDGE_MARKDOWN = String(dpOptimizationMarkdown || "").trim();

// Keep the old `section.markdown` field for integrations that imported
// DP_SECTIONS before the document was merged.  These are slices of the one
// canonical source, not independent files or render paths.
const DP_SECTION_MARKDOWN = DP_KNOWLEDGE_MARKDOWN
  .split(/(?=^##\s+\d+[.、])/m)
  .map((part) => part.trim())
  .filter(Boolean);

/** @type {DpSection[]} */
export const DP_SECTIONS = [
  {
    id: "intro",
    num: "00",
    title: "介绍",
    subtitle: "六类优化总览与选用顺序",
    markdown: DP_SECTION_MARKDOWN[0] || DP_KNOWLEDGE_MARKDOWN,
  },
  {
    id: "state-design",
    num: "01",
    title: "状态设计优化",
    subtitle: "滚动数组、值域交换、等价合并",
    markdown: DP_SECTION_MARKDOWN[1] || "",
  },
  {
    id: "prefix",
    num: "02",
    title: "前缀和与前缀最值优化",
    subtitle: "区间聚合压缩为 O(n)",
    markdown: DP_SECTION_MARKDOWN[2] || "",
  },
  {
    id: "data-structure",
    num: "03",
    title: "数据结构优化",
    subtitle: "单调队列、BIT、线段树",
    markdown: DP_SECTION_MARKDOWN[3] || "",
  },
  {
    id: "matrix",
    num: "04",
    title: "矩阵快速幂与倍增优化",
    subtitle: "阶段跳跃 O(log T)",
    markdown: DP_SECTION_MARKDOWN[4] || "",
  },
  {
    id: "bitset",
    num: "05",
    title: "位运算优化",
    subtitle: "bitset 压位加速布尔 DP",
    markdown: DP_SECTION_MARKDOWN[5] || "",
  },
  {
    id: "convolution",
    num: "06",
    title: "卷积优化",
    subtitle: "FFT / NTT / FWT / 分治",
    markdown: DP_SECTION_MARKDOWN[6] || "",
  },
];

/**
 * The DP wiki used to be rendered as seven independent panels.  Keep the
 * section metadata above (the legacy `/dp-optimization#…` links use it), but
 * also expose one Markdown source so it can be imported into the knowledge
 * article editor and rendered by the normal article reader.
 */
export const DP_KNOWLEDGE_SOURCE = "dp-optimization";
export const DP_KNOWLEDGE_ID = "builtin-dp-optimization";
export const DP_KNOWLEDGE_SOURCE_TAG = "内置专题·DP优化";

export const DP_KNOWLEDGE_ARTICLE = Object.freeze({
  id: DP_KNOWLEDGE_ID,
  title: "动态规划优化方法",
  summary: "从状态设计到卷积加速，系统整理六类常见 DP 优化手段。",
  content: DP_KNOWLEDGE_MARKDOWN,
  tags: Object.freeze(["动态规划", "算法", DP_KNOWLEDGE_SOURCE_TAG]),
  kind: "knowledge",
  status: "published",
  isBuiltin: true,
  source: DP_KNOWLEDGE_SOURCE,
  createdAt: null,
  updatedAt: null,
  publishedAt: null,
});

/** Whether a stored knowledge post is an imported copy of the built-in wiki. */
export function isDpKnowledgePost(post) {
  if (!post) return false;
  if (post.id === DP_KNOWLEDGE_ID) return true;
  if (post.kind !== "knowledge") return false;
  if (post.title === DP_KNOWLEDGE_ARTICLE.title) return true;
  return Array.isArray(post.tags) && post.tags.includes(DP_KNOWLEDGE_SOURCE_TAG);
}
