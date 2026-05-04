<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import DOMPurify from "dompurify";
import { getPostById, publishPost, unpublishPost, updatePost, POST_KIND } from "../utils/postStorage";
import { pushToast } from "../utils/toast";
import { SITE_TITLE } from "../constants";
import { createMarkdownIt, attachCopyButtons } from "../utils/markdownRenderer";
import "katex/dist/katex.min.css";

const route = useRoute();
const router = useRouter();

const articleKind = computed(() =>
  route.meta.articleKind === POST_KIND.journal ? POST_KIND.journal : POST_KIND.solution
);
const isJournal = computed(() => articleKind.value === POST_KIND.journal);
const listPath = computed(() => (isJournal.value ? "/journal" : "/solutions"));

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

const defaultMarkdown = computed(() =>
  isJournal.value ? journalDefaultMarkdown() : solutionDefaultMarkdown()
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

const md = createMarkdownIt();

const saveStatusText = computed(() => {
  if (saveState.value === "saving") return "保存中...";
  if (saveState.value === "saved") return "已保存";
  if (saveState.value === "error") return "保存失败";
  return "待保存";
});

const editorTitle = computed(() => (isJournal.value ? "游记 Markdown 编辑器" : "题解 Markdown 编辑器"));
const unnamedTitle = computed(() => (isJournal.value ? "未命名游记" : "未命名题解"));

function loadById(id) {
  const found = getPostById(id);
  if (!found) {
    router.replace(listPath.value);
    return;
  }
  const storedKind = found.kind === POST_KIND.journal ? POST_KIND.journal : POST_KIND.solution;
  if (storedKind !== articleKind.value) {
    router.replace(
      storedKind === POST_KIND.journal ? `/journal/${id}` : `/solutions/${id}`
    );
    return;
  }
  title.value = found.title || unnamedTitle.value;
  summary.value = found.summary || "";
  markdownText.value = found.content || defaultMarkdown.value;
  tagsText.value = Array.isArray(found.tags) ? found.tags.join(", ") : "";
  status.value = found.status || "draft";
  publishedAt.value = found.publishedAt || null;
  initialized.value = true;
  hasPendingChanges.value = false;
  saveState.value = "saved";
}

function saveCurrent() {
  if (!initialized.value) return;
  const id = route.params.id;
  if (typeof id !== "string" || !id) return;
  const tags = tagsText.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const result = updatePost(id, {
    title: title.value.trim() || unnamedTitle.value,
    summary: summary.value.trim(),
    tags,
    content: markdownText.value,
    kind: articleKind.value,
  });
  if (!result) {
    throw new Error("文章不存在，无法保存");
  }
}

function saveNow(showToast = false) {
  if (!initialized.value) return;
  if (saveTimer.value) {
    window.clearTimeout(saveTimer.value);
    saveTimer.value = null;
  }
  saveState.value = "saving";
  try {
    saveCurrent();
    saveState.value = "saved";
    hasPendingChanges.value = false;
    if (showToast) pushToast(isJournal.value ? "游记已保存" : "题解已保存", "success");
  } catch (error) {
    saveState.value = "error";
    pushToast(error?.message || "保存失败", "error", 3200);
  }
}

function queueSave() {
  if (!initialized.value) return;
  hasPendingChanges.value = true;
  saveState.value = "pending";
  if (saveTimer.value) window.clearTimeout(saveTimer.value);
  saveTimer.value = window.setTimeout(() => {
    saveNow(false);
  }, 600);
}

function onPublish() {
  if (!title.value.trim() || !markdownText.value.trim()) {
    alert("标题和正文不能为空，不能发布空文章。");
    return;
  }
  const id = route.params.id;
  if (typeof id !== "string" || !id) return;
  saveNow(false);
  const post = publishPost(id);
  if (post) {
    status.value = post.status;
    publishedAt.value = post.publishedAt;
    pushToast("发布成功，可通过公开链接访问", "success");
  }
}

function onUnpublish() {
  const id = route.params.id;
  if (typeof id !== "string" || !id) return;
  const post = unpublishPost(id);
  if (post) {
    status.value = post.status;
    publishedAt.value = post.publishedAt;
    pushToast("已取消发布", "info");
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

async function insertImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  try {
    const result = await readImageToDataUrl(file);
    const safeName = file.name || "image";
    insertAtCursor(`\n![${safeName}](${result})\n`);
    pushToast("图片已插入 Markdown", "success");
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveNow(true);
  }
}

watch(
  [() => route.params.id, articleKind],
  ([id]) => {
    initialized.value = false;
    if (typeof id === "string" && id) loadById(id);
  },
  { immediate: true }
);

watch([title, summary, tagsText, markdownText], () => {
  queueSave();
});

const renderedHtml = computed(() =>
  DOMPurify.sanitize(md.render(markdownText.value || ""))
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
    const tag = isJournal.value ? "游记编辑" : "题解编辑";
    document.title = `${head} · ${tag} · ${SITE_TITLE}`;
  }
);

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeydown);
  bindPreviewCopyButtons();
});

onBeforeUnmount(() => {
  if (saveTimer.value) window.clearTimeout(saveTimer.value);
  window.removeEventListener("keydown", onGlobalKeydown);
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

    <div class="editor-grid">
      <section class="panel">
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
          :placeholder="isJournal ? '游记标题' : '输入题解标题'"
        />
        <input
          v-model="summary"
          class="editor-title-input"
          :placeholder="isJournal ? '摘要：一句话介绍这趟旅程（列表展示）' : '文章摘要（用于列表展示）'"
        />
        <input
          v-model="tagsText"
          class="editor-title-input"
          :placeholder="
            isJournal
              ? '标签，用英文逗号分隔，如：自由行, 青岛, 三日'
              : '标签，用英文逗号分隔，如：图论, 最短路, Dijkstra'
          "
        />
        <div class="editor-tools">
          <label class="btn btn-ghost editor-upload-btn">
            上传图片
            <input type="file" accept="image/*" @change="handleImagePick" />
          </label>
          <span class="editor-tip">支持直接粘贴图片到编辑区</span>
        </div>
        <p v-if="publishedAt" class="editor-tip">
          发布时间：{{ new Date(publishedAt).toLocaleString("zh-CN", { hour12: false }) }}
        </p>
        <textarea
          ref="textareaRef"
          v-model="markdownText"
          class="editor-textarea"
          :placeholder="isJournal ? '在这里写 Markdown 游记…' : '在这里写 Markdown 题解…'"
          @keydown="handleEditorKeydown"
          @paste="handleEditorPaste"
        />
      </section>

      <section class="panel">
        <h3 class="panel-title">预览区</h3>
        <article ref="previewRef" class="markdown-preview" v-html="renderedHtml"></article>
      </section>
    </div>
  </main>
</template>
