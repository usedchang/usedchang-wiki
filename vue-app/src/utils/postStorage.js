const STORAGE_KEY = "usedchang-posts";

const defaultContent = `# 新建题解

## 题意
在这里填写题意。

## 思路
在这里填写思路。
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
  return readPosts();
}

export function getPostById(id) {
  return readPosts().find((post) => post.id === id) || null;
}

export function createPost() {
  const posts = readPosts();
  const now = Date.now();
  const post = {
    id: crypto.randomUUID().slice(0, 8),
    title: "新建题解",
    summary: "",
    content: defaultContent,
    tags: [],
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
  return updatedPost;
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
