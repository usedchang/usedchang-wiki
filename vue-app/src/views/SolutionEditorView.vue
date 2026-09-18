<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";
import DOMPurify from "dompurify";
import {
  getPostById,
  publishPost,
  unpublishPost,
  updatePost,
  getPostKindLabel,
  isPostKind,
  POST_KIND,
  POST_LIMITS,
} from "../utils/postStorage";
import { pushToast } from "../utils/toast";
import { SITE_TITLE } from "../constants";
import {
  createMarkdownIt,
  attachCopyButtons,
  MARKDOWN_SANITIZE_OPTIONS,
  renderMarkdown,
} from "../utils/markdownRenderer";
import { supabase, supabaseConfigured } from "../utils/supabase";
import {
  DP_KNOWLEDGE_ARTICLE,
  DP_KNOWLEDGE_SOURCE,
} from "../content/dp-optimization";
import "katex/dist/katex.min.css";

const route = useRoute();
const router = useRouter();

const articleKind = computed(() =>
  isPostKind(route.meta.articleKind) ? route.meta.articleKind : POST_KIND.solution
);
const isJournal = computed(() => articleKind.value === POST_KIND.journal);
const isKnowledge = computed(() => articleKind.value === POST_KIND.knowledge);
const listPath = computed(() => {
  if (isJournal.value) return "/admin/journal";
  if (isKnowledge.value) return "/admin/knowledge";
  return "/admin/solutions";
});

function solutionDefaultMarkdown() {
  return `# 题解标题

## 题意
给定一个数组，求满足条件的子数组数量。

## 思路
使用前缀和 + 哈希统计。

### 复杂度
- 时间复杂度：$O(n)$
- 空间复杂度：$O(n)$

## 公式示例
行内公式：$a^2+b^2=c^2$

块级公式：
$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$

## 代码
\`\`\`cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);
  cout << "Hello XCPC\\n";
  return 0;
}
\`\`\`
`;
}

function journalDefaultMarkdown() {
  return `# 游记标题

## 这趟旅途
目的地、天数、同行伙伴。

## Day 1
记录动线、吃喝与心情。

## 配图
将图片粘贴到编辑区即可插入。
`;
}

function knowledgeDefaultMarkdown() {
  return `# 知识学习标题

## 核心概念
在这里整理要学习的知识点。

## 详细内容
补充推导、示例和代码模板。
`;
}

const defaultMarkdown = computed(() =>
  isJournal.value
    ? journalDefaultMarkdown()
    : isKnowledge.value
      ? knowledgeDefaultMarkdown()
      : solutionDefaultMarkdown()
);

const markdownText = ref("");
const title = ref("");
const summary = ref("");
const tagsText = ref("");
const status = ref("draft");
const publishedAt = ref(null);
const initialized = ref(false);
const textareaRef = ref(null);
const previewRef = ref(null);
const saveState = ref("saved");
const saveTimer = ref(null);
const hasPendingChanges = ref(false);
const isHydrating = ref(false);
const isDraggingFile = ref(false);
const activePane = ref("split");
const importingFile = ref(false);
const loadedPostId = ref(null);

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_LOCAL_IMAGE_SIZE = 512 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const md = createMarkdownIt();

const saveStatusText = computed(() => {
  if (saveState.value === "saving") return "保存中...";
  if (saveState.value === "saved") return "已保存";
  if (saveState.value === "error") return "保存失败";
  return "待保存";
});

const editorTitle = computed(() => `${getPostKindLabel(articleKind.value)} Markdown 编辑器`);
const unnamedTitle = computed(() => {
  if (isJournal.value) return "未命名游记";
  if (isKnowledge.value) return "未命名知识学习";
  return "未命名题解";
});
const wordCount = computed(() => markdownText.value.trim().length);
const lineCount = computed(() => (markdownText.value ? markdownText.value.split(/\r?\n/).length : 0));

const toolbarItems = [
  { label: "H2", text: "## " },
  { label: "粗体", text: "****", cursorOffset: -2 },
  { label: "斜体", text: "__", cursorOffset: -1 },
  { label: "代码", text: "```cpp\n\n```", cursorOffset: -7 },
  { label: "引用", text: "> " },
  { label: "链接", text: "[链接文字](https://)", cursorOffset: -1 },
];

let saveChain = Promise.resolve();
let loadRequest = 0;
let editVersion = 0;

async function loadById(id) {
  const request = ++loadRequest;
  let importedBuiltin = false;
  isHydrating.value = true;
  try {
    const found = await getPostById(id, { includeDrafts: true });
    if (request !== loadRequest) return;
    if (!found) {
      router.replace(listPath.value);
      return;
    }
    const storedKind = isPostKind(found.kind) ? found.kind : POST_KIND.solution;
    if (storedKind !== articleKind.value) {
      const target = storedKind === POST_KIND.journal
        ? "/admin/journal/"
        : storedKind === POST_KIND.knowledge
          ? "/admin/knowledge/"
          : "/admin/solutions/";
      router.replace(target + id);
      return;
    }
    title.value = found.title || unnamedTitle.value;
    summary.value = found.summary || "";
    markdownText.value = found.content || defaultMarkdown.value;
    tagsText.value = Array.isArray(found.tags) ? found.tags.join(", ") : "";
    status.value = found.status || "draft";
    publishedAt.value = found.publishedAt || null;
    if (articleKind.value === POST_KIND.knowledge && route.query.source === DP_KNOWLEDGE_SOURCE) {
      title.value = DP_KNOWLEDGE_ARTICLE.title;
      summary.value = DP_KNOWLEDGE_ARTICLE.summary;
      markdownText.value = DP_KNOWLEDGE_ARTICLE.content;
      tagsText.value = DP_KNOWLEDGE_ARTICLE.tags.join(", ");
      importedBuiltin = true;
    }
    loadedPostId.value = id;
    editVersion = 0;
    initialized.value = true;
    hasPendingChanges.value = importedBuiltin;
    saveState.value = importedBuiltin ? "pending" : "saved";
  } catch (error) {
    if (request !== loadRequest) return;
    initialized.value = false;
    loadedPostId.value = null;
    pushToast(error?.message || "读取文章失败", "error", 3200);
    router.replace(listPath.value);
  } finally {
    if (request === loadRequest) {
      await nextTick();
      isHydrating.value = false;
      if (importedBuiltin && initialized.value && loadedPostId.value === id) {
        editVersion += 1;
        const saved = await saveNow(false);
        if (saved) {
          pushToast("已导入 DP 优化 Markdown，可继续编辑或发布", "success");
          const query = { ...route.query };
          delete query.source;
          await router.replace({ query });
        }
      }
    }
  }
}

function createSaveSnapshot() {
  const id = route.params.id;
  if (!initialized.value || typeof id !== "string" || !id || loadedPostId.value !== id) {
    return null;
  }
  const tags = [...new Set(
    tagsText.value
      .split(",")
      .map((tag) => tag.trim().slice(0, POST_LIMITS.tag))
      .filter(Boolean)
  )]
    .slice(0, POST_LIMITS.tags);
  return {
    id,
    version: editVersion,
    patch: {
      title: (title.value.trim() || unnamedTitle.value).slice(0, POST_LIMITS.title),
      summary: summary.value.trim().slice(0, POST_LIMITS.summary),
      tags,
      content: markdownText.value,
      kind: articleKind.value,
    },
  };
}

async function saveCurrent(snapshot) {
  if (snapshot.patch.content.length > POST_LIMITS.content) {
    throw new Error("文章正文不能超过 100 万字符");
  }
  const result = await updatePost(snapshot.id, snapshot.patch);
  if (!result) throw new Error("文章不存在，无法保存");
  return result;
}

function saveNow(showToast = false) {
  const snapshot = createSaveSnapshot();
  if (!snapshot) return Promise.resolve(false);
  if (saveTimer.value) {
    window.clearTimeout(saveTimer.value);
    saveTimer.value = null;
  }
  const operation = saveChain.then(async () => {
    const isCurrentPost = () => loadedPostId.value === snapshot.id;
    if (isCurrentPost()) saveState.value = "saving";
    try {
      await saveCurrent(snapshot);
      if (isCurrentPost()) {
        const isLatestVersion = editVersion === snapshot.version;
        saveState.value = isLatestVersion ? "saved" : "pending";
        hasPendingChanges.value = !isLatestVersion;
        if (showToast && isLatestVersion) {
          pushToast(`${getPostKindLabel(articleKind.value)}已保存`, "success");
        }
      }
      return true;
    } catch (error) {
      if (isCurrentPost()) saveState.value = "error";
      pushToast(error?.message || "保存失败", "error", 3200);
      return false;
    }
  });
  saveChain = operation.catch(() => false);
  return operation;
}

function queueSave() {
  if (!initialized.value || isHydrating.value) return;
  hasPendingChanges.value = true;
  saveState.value = "pending";
  if (saveTimer.value) window.clearTimeout(saveTimer.value);
  saveTimer.value = window.setTimeout(() => {
    void saveNow(false);
  }, 600);
}

async function onPublish() {
  if (!title.value.trim() || !markdownText.value.trim()) {
    alert("标题和正文不能为空，不能发布空文章。");
    return;
  }
  const id = route.params.id;
  if (typeof id !== "string" || !id) return;
  if (!(await saveNow(false))) return;
  try {
    const post = await publishPost(id);
    status.value = post.status;
    publishedAt.value = post.publishedAt;
    pushToast("发布成功，可通过公开链接访问", "success");
  } catch (error) {
    pushToast(error?.message || "发布失败", "error", 3200);
  }
}

async function onUnpublish() {
  const id = route.params.id;
  if (typeof id !== "string" || !id) return;
  try {
    const post = await unpublishPost(id);
    status.value = post.status;
    publishedAt.value = post.publishedAt;
    pushToast("已取消发布", "info");
  } catch (error) {
    pushToast(error?.message || "操作失败", "error", 3200);
  }
}

function insertAtCursor(text) {
  const el = textareaRef.value;
  if (!el) {
    markdownText.value += text;
    return;
  }
  const start = el.selectionStart ?? markdownText.value.length;
  const end = el.selectionEnd ?? markdownText.value.length;
  markdownText.value = `${markdownText.value.slice(0, start)}${text}${markdownText.value.slice(end)}`;
  const cursor = start + text.length;
  window.requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(cursor, cursor);
  });
}

function insertToolbarItem(item) {
  const el = textareaRef.value;
  if (!el) {
    insertAtCursor(item.text);
    return;
  }
  const start = el.selectionStart ?? markdownText.value.length;
  const end = el.selectionEnd ?? markdownText.value.length;
  const selected = markdownText.value.slice(start, end);
  let insertion = item.text;
  if (item.label === "粗体" && selected) insertion = `**${selected}**`;
  if (item.label === "斜体" && selected) insertion = `*${selected}*`;
  if (item.label === "链接" && selected) insertion = `[${selected}](https://)`;
  markdownText.value = `${markdownText.value.slice(0, start)}${insertion}${markdownText.value.slice(end)}`;
  const offset = selected ? insertion.length : Math.max(0, insertion.length + (item.cursorOffset || 0));
  window.requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + offset, start + offset);
  });
}

function handleEditorKeydown(event) {
  if (event.key === "Tab") {
    event.preventDefault();
    insertAtCursor("  ");
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveNow(true);
  }
}

function readImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function safeStorageName(name) {
  return String(name || "image")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "image";
}

async function uploadImage(file) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("仅支持 JPEG、PNG、WebP 或 GIF 图片");
  }
  if (file.size > MAX_IMAGE_SIZE) throw new Error("图片不能超过 5 MB");

  if (!supabaseConfigured) {
    if (file.size > MAX_LOCAL_IMAGE_SIZE) {
      throw new Error("本地模式图片不能超过 512 KB；配置 Supabase 后可上传至 5 MB");
    }
    return readImageToDataUrl(file);
  }
  const path = `${crypto.randomUUID()}-${safeStorageName(file.name)}`;
  const { error } = await supabase.storage.from("post-images").upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(`图片上传失败：${error.message}`);
  const { data } = supabase.storage.from("post-images").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("图片上传成功，但无法生成公开地址");
  return data.publicUrl;
}

function parseFrontmatter(source) {
  const text = String(source || "").replace(/^\uFEFF/, "");
  if (!text.startsWith("---")) return { metadata: {}, content: text };
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { metadata: {}, content: text };
  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    let value = line.slice(separator + 1).trim();
    if (!key) continue;
    if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith("{") && value.endsWith("}"))) {
      try {
        value = JSON.parse(value);
      } catch {
        // Keep malformed YAML-like values as plain text.
      }
    } else if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    metadata[key] = value;
  }
  return { metadata, content: text.slice(match[0].length) };
}

function titleFromMarkdown(content, filename) {
  const heading = String(content || "").match(/^\s*#\s+(.+)$/m);
  if (heading?.[1]) return heading[1].trim();
  return String(filename || "").replace(/\.markdown?$/i, "").trim();
}

async function importMarkdownFile(file) {
  if (!file || importingFile.value) return;
  const isMarkdown = /\.markdown?$/i.test(file.name || "") || file.type === "text/markdown" || file.type === "text/plain";
  if (!isMarkdown) {
    pushToast("请选择 .md 或 .markdown 文件", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    pushToast("Markdown 文件不能超过 5 MB", "error");
    return;
  }
  importingFile.value = true;
  try {
    const source = await file.text();
    if (source.length > POST_LIMITS.content) {
      throw new Error("Markdown 正文不能超过 100 万字符");
    }
    const { metadata, content } = parseFrontmatter(source);
    markdownText.value = content.trimStart();
    const importedTitle = metadata.title || metadata.name || titleFromMarkdown(content, file.name);
    if (importedTitle) title.value = String(importedTitle).trim();
    const importedSummary = metadata.summary || metadata.description || metadata.excerpt;
    if (importedSummary !== undefined) summary.value = String(importedSummary);
    const importedTags = metadata.tags || metadata.categories;
    if (Array.isArray(importedTags)) tagsText.value = importedTags.join(", ");
    else if (typeof importedTags === "string") tagsText.value = importedTags.replace(/[\[\]]/g, "");
    pushToast(`已导入：${file.name}`, "success");
  } catch (error) {
    pushToast(error?.message || "Markdown 导入失败", "error", 3200);
  } finally {
    importingFile.value = false;
  }
}

async function handleMarkdownPick(event) {
  const file = event.target?.files?.[0];
  await importMarkdownFile(file);
  if (event.target) event.target.value = "";
}

function handleFileDragOver() {
  isDraggingFile.value = true;
}

function handleFileDragLeave(event) {
  if (event.currentTarget === event.target || !event.currentTarget.contains(event.relatedTarget)) {
    isDraggingFile.value = false;
  }
}

async function handleFileDrop(event) {
  isDraggingFile.value = false;
  const file = event.dataTransfer?.files?.[0];
  await importMarkdownFile(file);
}

function exportMarkdown() {
  const safeTitle = (title.value.trim() || unnamedTitle.value).replace(/[\\/:*?"<>|]/g, "-");
  const blob = new Blob([markdownText.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle || "article"}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function insertImageFile(file) {
  if (!file) return;
  try {
    const result = await uploadImage(file);
    const safeName = file.name || "image";
    insertAtCursor(`\n![${safeName}](${result})\n`);
    pushToast(supabaseConfigured ? "图片已上传并插入 Markdown" : "图片已插入（当前为本地临时地址）", "success");
  } catch (error) {
    pushToast(error?.message || "图片插入失败", "error", 3200);
  }
}

async function handleImagePick(event) {
  const file = event.target?.files?.[0];
  await insertImageFile(file);
  event.target.value = "";
}

async function handleEditorPaste(event) {
  const items = event.clipboardData?.items || [];
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      await insertImageFile(file);
      break;
    }
  }
}

function onGlobalKeydown(event) {
  if (event.defaultPrevented) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveNow(true);
  }
}

watch(
  [() => route.params.id, articleKind],
  ([id]) => {
    initialized.value = false;
    loadedPostId.value = null;
    if (typeof id === "string" && id) loadById(id);
  },
  { immediate: true }
);

watch([title, summary, tagsText, markdownText], () => {
  if (!isHydrating.value) {
    editVersion += 1;
    queueSave();
  }
});

async function saveBeforeNavigation() {
  if (!initialized.value || (!hasPendingChanges.value && saveState.value !== "saving")) return true;
  // 路由等待期间仍可能收到最后一次输入；保存到版本稳定后才允许离开。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await saveNow(false))) return false;
    if (!hasPendingChanges.value) return true;
  }
  return false;
}

onBeforeRouteLeave(saveBeforeNavigation);
onBeforeRouteUpdate((to, from) => {
  if (to.params.id === from.params.id && to.meta.articleKind === from.meta.articleKind) return true;
  return saveBeforeNavigation();
});

function handleBeforeUnload(event) {
  if (!hasPendingChanges.value && saveState.value !== "saving") return;
  event.preventDefault();
  event.returnValue = "";
}

const renderedHtml = computed(() =>
  markdownText.value.length > POST_LIMITS.content
    ? '<p class="auth-error">正文超过 100 万字符，预览已暂停；请缩减内容后保存。</p>'
    : DOMPurify.sanitize(
        renderMarkdown(md, markdownText.value).html,
        MARKDOWN_SANITIZE_OPTIONS
      )
);

function bindPreviewCopyButtons() {
  nextTick(() => {
    if (previewRef.value) attachCopyButtons(previewRef.value);
  });
}

watch(renderedHtml, bindPreviewCopyButtons);

watch(
  () => [title.value, isJournal.value, initialized.value, unnamedTitle.value],
  () => {
    if (!initialized.value) return;
    const head = title.value?.trim() || unnamedTitle.value;
    const tag = `${getPostKindLabel(articleKind.value)}编辑`;
    document.title = `${head} · ${tag} · ${SITE_TITLE}`;
  }
);

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeydown);
  window.addEventListener("beforeunload", handleBeforeUnload);
  bindPreviewCopyButtons();
});

onBeforeUnmount(() => {
  loadRequest += 1;
  if (saveTimer.value) window.clearTimeout(saveTimer.value);
  window.removeEventListener("keydown", onGlobalKeydown);
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<template>
  <main class="container section editor-page">
    <div class="section-title-row">
      <h2>{{ editorTitle }}</h2>
      <span class="editor-tip">
        状态：{{ status === "published" ? "已发布" : "草稿" }} · 公开 URL：/posts/{{ route.params.id }}
      </span>
    </div>
    <div class="editor-page-tools">
      <div class="editor-pane-switch" role="tablist" aria-label="编辑器布局">
        <button type="button" class="btn btn-ghost btn-sm" :class="{ 'editor-pane-active': activePane === 'edit' }" @click="activePane = 'edit'">编辑</button>
        <button type="button" class="btn btn-ghost btn-sm" :class="{ 'editor-pane-active': activePane === 'split' }" @click="activePane = 'split'">并排</button>
        <button type="button" class="btn btn-ghost btn-sm" :class="{ 'editor-pane-active': activePane === 'preview' }" @click="activePane = 'preview'">预览</button>
      </div>
      <span class="editor-counter">{{ wordCount }} 字 · {{ lineCount }} 行</span>
    </div>

    <div class="editor-grid" :class="`editor-layout-${activePane}`">
      <section
        class="panel editor-panel"
        :class="{ 'editor-panel-hidden': activePane === 'preview' }"
        @dragover.prevent="handleFileDragOver"
        @dragleave="handleFileDragLeave"
        @drop.prevent="handleFileDrop"
      >
        <div class="section-title-row">
          <h3 class="panel-title">编辑区</h3>
          <div class="card-actions">
            <button class="btn btn-ghost" @click="saveNow(true)">保存（Ctrl+S）</button>
            <button v-if="status !== 'published'" class="btn btn-primary" @click="onPublish">发布</button>
            <button v-else class="btn btn-ghost" @click="onUnpublish">取消发布</button>
            <RouterLink class="btn btn-ghost" :to="listPath">返回列表</RouterLink>
          </div>
        </div>
        <p class="editor-save-state">
          保存状态：{{ saveStatusText }}<span v-if="hasPendingChanges">（检测到改动）</span>
        </p>
        <input
          v-model="title"
          class="editor-title-input"
          maxlength="200"
          :placeholder="isJournal ? '游记标题' : (isKnowledge ? '知识学习标题' : '输入题解标题')"
        />
        <input
          v-model="summary"
          class="editor-title-input"
          maxlength="1000"
          :placeholder="
            isJournal
              ? '摘要：一句话介绍这趟旅程（列表展示）'
              : (isKnowledge ? '摘要：一句话概括知识点（列表展示）' : '文章摘要（用于列表展示）')
          "
        />
        <input
          v-model="tagsText"
          class="editor-title-input"
          :maxlength="POST_LIMITS.tags * (POST_LIMITS.tag + 1)"
          :placeholder="
            isJournal
              ? '标签，用英文逗号分隔，如：自由行, 青岛, 三日'
              : (isKnowledge ? '标签，用英文逗号分隔，如：DP, 数据结构, 数学' : '标签，用英文逗号分隔，如：图论, 最短路, Dijkstra')
          "
        />
        <div class="editor-tools editor-toolbar" aria-label="Markdown 工具栏">
          <button
            v-for="item in toolbarItems"
            :key="item.label"
            type="button"
            class="btn btn-ghost btn-sm"
            :title="`插入${item.label}`"
            @click="insertToolbarItem(item)"
          >
            {{ item.label }}
          </button>
          <label class="btn btn-ghost editor-upload-btn">
            上传图片
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              @change="handleImagePick"
            />
          </label>
          <label class="btn btn-primary editor-upload-btn" :class="{ 'btn-loading': importingFile }">
            {{ importingFile ? "导入中…" : "导入 Markdown" }}
            <input
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              @change="handleMarkdownPick"
            />
          </label>
          <button type="button" class="btn btn-ghost" @click="exportMarkdown">导出 .md</button>
          <span class="editor-tip">可拖入 .md 文件，也可直接粘贴图片</span>
        </div>
        <p v-if="isDraggingFile" class="editor-drop-hint">松开鼠标即可导入 Markdown 文件</p>
        <p v-if="publishedAt" class="editor-tip">
          发布时间：{{ new Date(publishedAt).toLocaleString("zh-CN", { hour12: false }) }}
        </p>
        <textarea
          ref="textareaRef"
          v-model="markdownText"
          class="editor-textarea"
          :maxlength="POST_LIMITS.content"
          :placeholder="isJournal ? '在这里写 Markdown 游记…' : (isKnowledge ? '在这里写 Markdown 知识学习笔记…' : '在这里写 Markdown 题解…')"
          @keydown="handleEditorKeydown"
          @paste="handleEditorPaste"
        />
      </section>

      <section class="panel editor-panel" :class="{ 'editor-panel-hidden': activePane === 'edit' }">
        <h3 class="panel-title">预览区</h3>
        <article ref="previewRef" class="markdown-preview" v-html="renderedHtml"></article>
      </section>
    </div>
  </main>
</template>
