import { supabase, supabaseConfigured } from "./supabase";

/** @typedef {"solution" | "journal" | "knowledge"} PostKind */

export const POST_KIND = {
  solution: "solution",
  journal: "journal",
  knowledge: "knowledge",
};

const POST_KIND_LABELS = Object.freeze({
  [POST_KIND.solution]: "题解",
  [POST_KIND.journal]: "游记",
  [POST_KIND.knowledge]: "知识学习",
});

export function isPostKind(kind) {
  return Object.values(POST_KIND).includes(kind);
}

export function getPostKindLabel(kind) {
  return POST_KIND_LABELS[kind] || POST_KIND_LABELS[POST_KIND.solution];
}

export const POST_LIMITS = Object.freeze({
  title: 200,
  summary: 1000,
  content: 1_000_000,
  tags: 30,
  tag: 40,
});

const STORAGE_KEY = "usedchang-posts";
const REMOTE_POST_COLUMNS = [
  "id",
  "title",
  "summary",
  "content",
  "tags",
  "kind",
  "status",
  "created_at",
  "updated_at",
  "published_at",
].join(",");
const defaultContent = [
  "# 新建题解",
  "",
  "## 题意",
  "在这里填写题意。",
  "",
  "## 思路",
  "在这里填写思路。",
  "",
].join("\n");
const defaultJournalContent = [
  "# 游记标题",
  "",
  "## 这趟旅途",
  "写下目的地、天数、同行伙伴，以及一句最想记住的心情。",
  "",
  "## Day 1｜出发与抵达",
  "记录动线、交通、住宿与第一印象。",
  "",
].join("\n");
const defaultKnowledgeContent = [
  "# 知识学习标题",
  "",
  "## 核心概念",
  "在这里整理要学习的知识点。",
  "",
  "## 详细内容",
  "补充推导、示例和代码模板。",
  "",
].join("\n");

function readLocalPosts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalPosts(posts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch (error) {
    if (error?.name === "QuotaExceededError") {
      throw new Error("浏览器本地存储空间不足，请删除大图或配置 Supabase 后再保存");
    }
    throw error;
  }
}

function normalizePost(post) {
  if (!post) return null;
  const tags = (Array.isArray(post.tags)
    ? post.tags
    : typeof post.tags === "string"
      ? post.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [])
    .filter((tag) => typeof tag === "string" || typeof tag === "number")
    .map((tag) => String(tag).trim().slice(0, POST_LIMITS.tag))
    .filter(Boolean)
    .slice(0, POST_LIMITS.tags);
  const asTimestamp = (value) => {
    if (!value) return null;
    if (typeof value === "number") return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  };
  return {
    ...post,
    kind: isPostKind(post.kind) ? post.kind : POST_KIND.solution,
    tags,
    createdAt: asTimestamp(post.createdAt ?? post.created_at),
    updatedAt: asTimestamp(post.updatedAt ?? post.updated_at),
    publishedAt: asTimestamp(post.publishedAt ?? post.published_at),
  };
}

function fromRemotePost(row) {
  if (!row) return null;
  return normalizePost({
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    tags: row.tags,
    kind: row.kind,
    status: row.status,
    authorId: row.author_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at: row.published_at,
  });
}

function toRemotePatch(patch = {}) {
  const next = {};
  if (patch.title !== undefined) next.title = String(patch.title).slice(0, POST_LIMITS.title);
  if (patch.summary !== undefined) next.summary = String(patch.summary).slice(0, POST_LIMITS.summary);
  if (patch.content !== undefined) {
    const content = String(patch.content);
    if (content.length > POST_LIMITS.content) {
      throw new Error("文章正文不能超过 100 万字符");
    }
    next.content = content;
  }
  if (patch.tags !== undefined) {
    next.tags = Array.isArray(patch.tags)
      ? [...new Set(
          patch.tags
            .map((tag) => String(tag).trim().slice(0, POST_LIMITS.tag))
            .filter(Boolean)
        )].slice(0, POST_LIMITS.tags)
      : [];
  }
  if (patch.kind !== undefined) {
    next.kind = isPostKind(patch.kind) ? patch.kind : POST_KIND.solution;
  }
  if (patch.status !== undefined) next.status = patch.status === "published" ? "published" : "draft";
  if (patch.publishedAt !== undefined) {
    next.published_at = patch.publishedAt ? new Date(patch.publishedAt).toISOString() : null;
  }
  return next;
}

function localGetAllPosts(includeDrafts = true, includeContent = false) {
  const posts = readLocalPosts()
    .map(normalizePost)
    .filter(Boolean)
    .filter((post) => includeDrafts || post.status === "published");
  if (includeContent) return posts;
  return posts.map(({ content: _content, ...post }) => post);
}

function localGetPostById(id, includeDrafts = true) {
  return localGetAllPosts(includeDrafts, true).find((post) => post.id === id) || null;
}

/** 获取文章。默认只返回已发布文章；管理页传 includeDrafts:true。 */
export async function getAllPosts({ includeDrafts = false, includeContent = false } = {}) {
  if (!supabaseConfigured) return localGetAllPosts(includeDrafts, includeContent);
  const columns = includeContent
    ? REMOTE_POST_COLUMNS
    : "id,title,summary,tags,kind,status,created_at,updated_at,published_at";
  let query = supabase.from("posts").select(columns).order("updated_at", { ascending: false });
  if (!includeDrafts) query = query.eq("status", "published");
  const { data, error } = await query;
  if (error) throw new Error("读取文章失败：" + error.message);
  return (data || []).map(fromRemotePost);
}

export async function getPostById(id, { includeDrafts = false } = {}) {
  if (!id) return null;
  if (!supabaseConfigured) return localGetPostById(id, includeDrafts);
  let query = supabase.from("posts").select(REMOTE_POST_COLUMNS).eq("id", id);
  if (!includeDrafts) query = query.eq("status", "published");
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("读取文章失败：" + error.message);
  return fromRemotePost(data);
}

export async function createPost({ kind = POST_KIND.solution } = {}) {
  const normalizedKind = isPostKind(kind) ? kind : POST_KIND.solution;
  const now = Date.now();
  const defaultTitle = normalizedKind === POST_KIND.journal
    ? "新建游记"
    : normalizedKind === POST_KIND.knowledge
      ? "新建知识学习"
      : "新建题解";
  const defaultContentForKind = normalizedKind === POST_KIND.journal
    ? defaultJournalContent
    : normalizedKind === POST_KIND.knowledge
      ? defaultKnowledgeContent
      : defaultContent;
  const localPost = {
    id: crypto.randomUUID(),
    title: defaultTitle,
    summary: "",
    content: defaultContentForKind,
    tags: [],
    kind: normalizedKind,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };
  if (!supabaseConfigured) {
    writeLocalPosts([localPost, ...readLocalPosts()]);
    return normalizePost(localPost);
  }
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      id: localPost.id,
      title: localPost.title,
      summary: "",
      content: localPost.content,
      tags: [],
      kind: normalizedKind,
      status: "draft",
      author_id: userData.user?.id || null,
    })
    .select(REMOTE_POST_COLUMNS)
    .single();
  if (error) throw new Error("新建文章失败：" + error.message);
  return fromRemotePost(data);
}

export async function updatePost(id, patch) {
  if (!supabaseConfigured) {
    const posts = readLocalPosts();
    let updated = null;
    const next = posts.map((post) => {
      if (post.id !== id) return post;
      updated = { ...post, ...patch, updatedAt: Date.now() };
      return updated;
    });
    writeLocalPosts(next);
    return normalizePost(updated);
  }
  const { data, error } = await supabase
    .from("posts")
    .update(toRemotePatch(patch))
    .eq("id", id)
    .select(REMOTE_POST_COLUMNS)
    .single();
  if (error) throw new Error("保存文章失败：" + error.message);
  return fromRemotePost(data);
}

export async function removePost(id) {
  if (!supabaseConfigured) {
    writeLocalPosts(readLocalPosts().filter((post) => post.id !== id));
    return;
  }
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error("删除文章失败：" + error.message);
}

export async function publishPost(id) {
  return updatePost(id, { status: "published", publishedAt: Date.now() });
}

export async function unpublishPost(id) {
  return updatePost(id, { status: "draft", publishedAt: null });
}

/** 将旧 localStorage 文章上传到 Supabase，重复执行不会覆盖远端文章。 */
export async function migrateLocalPostsToSupabase() {
  if (!supabaseConfigured) throw new Error("请先配置 Supabase 环境变量");
  const localPosts = readLocalPosts().map(normalizePost);
  let migrated = 0;
  let skipped = 0;
  const errors = [];
  const { data: userData } = await supabase.auth.getUser();
  for (const post of localPosts) {
    const { data: existing, error: readError } = await supabase
      .from("posts")
      .select("id")
      .eq("id", post.id)
      .maybeSingle();
    if (readError) {
      errors.push(post.id + ": " + readError.message);
      skipped++;
      continue;
    }
    if (existing) {
      skipped++;
      continue;
    }
    const { error } = await supabase.from("posts").insert({
      id: post.id,
      title: post.title || "",
      summary: post.summary || "",
      content: post.content || "",
      tags: Array.isArray(post.tags) ? post.tags : [],
      kind: post.kind,
      status: post.status === "published" ? "published" : "draft",
      author_id: userData.user?.id || null,
      created_at: post.createdAt ? new Date(post.createdAt).toISOString() : undefined,
      updated_at: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
      published_at: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
    });
    if (error) {
      errors.push(post.id + ": " + error.message);
      skipped++;
    } else {
      migrated++;
    }
  }
  return { migrated, skipped, errors };
}
