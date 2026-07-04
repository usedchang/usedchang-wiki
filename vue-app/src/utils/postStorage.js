const STORAGE_KEY = "usedchang-posts";

/** @typedef {"solution" | "journal"} PostKind */

export const POST_KIND = {
  solution: "solution",
  journal: "journal",
};

const defaultContent = `# 新建题解

## 题意
在这里填写题意。

## 思路
在这里填写思路。
`;

const defaultJournalContent = `# 游记标题

## 这趟旅途
写下目的地、天数、同行伙伴，以及一句最想记住的心情。

## Day 1｜出发与抵达
记录动线、交通、住宿与第一印象。

> 旅途里最动人的，常常是计划之外的小插曲。

## 配图与随笔
在左侧编辑区直接**粘贴图片**即可插入；也可使用 Markdown：

\`\`\`
![海边日落](图片地址或粘贴后的链接)
\`\`\`
`;

function readPosts() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

export function getAllPosts() {
  return readPosts().map(normalizePost);
}

function normalizePost(post) {
  const kind = post.kind === POST_KIND.journal ? POST_KIND.journal : POST_KIND.solution;
  return { ...post, kind };
}

export function getPostById(id) {
  const found = readPosts().find((post) => post.id === id) || null;
  return found ? normalizePost(found) : null;
}

/**
 * @param {{ kind?: PostKind }} [options]
 */
export function createPost(options = {}) {
  const kind = options.kind === POST_KIND.journal ? POST_KIND.journal : POST_KIND.solution;
  const posts = readPosts();
  const now = Date.now();
  const post = {
    id: crypto.randomUUID().slice(0, 8),
    title: kind === POST_KIND.journal ? "新建游记" : "新建题解",
    summary: "",
    content: kind === POST_KIND.journal ? defaultJournalContent : defaultContent,
    tags: [],
    kind,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };
  posts.unshift(post);
  writePosts(posts);
  return post;
}

export function updatePost(id, patch) {
  const posts = readPosts();
  let updatedPost = null;
  const next = posts.map((post) => {
    if (post.id !== id) return post;
    updatedPost = {
      ...post,
      ...patch,
      updatedAt: Date.now(),
    };
    return updatedPost;
  });
  writePosts(next);
  return updatedPost ? normalizePost(updatedPost) : null;
}

export function removePost(id) {
  const next = readPosts().filter((post) => post.id !== id);
  writePosts(next);
}

export function publishPost(id) {
  return updatePost(id, {
    status: "published",
    publishedAt: Date.now(),
  });
}

export function unpublishPost(id) {
  return updatePost(id, {
    status: "draft",
    publishedAt: null,
  });
}
