<script setup>
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useRoute } from "vue-router";
import MarkdownIt from "markdown-it";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItFootnote from "markdown-it-footnote";
import markdownItDeflist from "markdown-it-deflist";
import markdownItMark from "markdown-it-mark";
import markdownItSub from "markdown-it-sub";
import markdownItSup from "markdown-it-sup";
import markdownItTexmath from "markdown-it-texmath";
import katex from "katex";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { getPostById } from "../utils/postStorage";
import { getCommentsByPostId, createComment, addReply, likeComment, deleteComment } from "../utils/commentStorage";
import "katex/dist/katex.min.css";
// 导入所有需要的代码高亮样式
import "highlight.js/styles/github.css";
import "highlight.js/styles/vs2015.css";
import "highlight.js/styles/github-dark.css";

// 主题对应的代码高亮样式类
const themeToHighlightClass = {
  academic: "github",
  modern: "vs2015",
  dark: "github-dark",
  eyecare: "github"
};

// 动态切换代码高亮样式
function switchHighlightStyle(theme) {
  const styleClass = themeToHighlightClass[theme] || "github";
  
  // 获取所有代码块
  const codeElements = document.querySelectorAll('pre.hljs, code.hljs');
  
  codeElements.forEach(element => {
    // 移除所有高亮样式类
    element.classList.remove('github', 'vs2015', 'github-dark');
    // 添加当前主题对应的样式类
    element.classList.add(styleClass);
  });
}

// 监听主题变化
function setupThemeWatcher() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "data-theme") {
        const theme = document.documentElement.getAttribute("data-theme") || "academic";
        switchHighlightStyle(theme);
      }
    });
  });
  
  observer.observe(document.documentElement, {
    attributes: true
  });
  
  // 初始加载
  const initialTheme = document.documentElement.getAttribute("data-theme") || "academic";
  switchHighlightStyle(initialTheme);
  
  return observer;
}

const route = useRoute();
const post = ref(null);
const comments = ref([]);
const commentContent = ref("");
const authorName = ref("");
const replyTo = ref(null);
const replyContent = ref("");

function formatTime(ts) {
  if (!ts) return "未知时间";
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function loadPost(id) {
  if (typeof id !== "string" || !id) {
    post.value = null;
    return;
  }
  post.value = getPostById(id);
  loadComments(id);
  
  // 延迟执行，确保DOM已经更新
  nextTick(() => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "academic";
    switchHighlightStyle(currentTheme);
  });
}

function loadComments(postId) {
  comments.value = getCommentsByPostId(postId);
}

function submitComment() {
  if (!commentContent.value.trim()) return;
  const author = authorName.value.trim() || "匿名用户";
  createComment(post.value.id, commentContent.value.trim(), author);
  commentContent.value = "";
  authorName.value = "";
  loadComments(post.value.id);
}

function submitReply() {
  if (!replyContent.value.trim() || !replyTo.value) return;
  const author = authorName.value.trim() || "匿名用户";
  addReply(replyTo.value, replyContent.value.trim(), author);
  replyContent.value = "";
  replyTo.value = null;
  loadComments(post.value.id);
}

function handleLike(commentId) {
  likeComment(commentId);
  loadComments(post.value.id);
}

function handleDelete(commentId) {
  if (confirm("确定要删除这条评论吗？")) {
    deleteComment(commentId);
    loadComments(post.value.id);
  }
}

function startReply(commentId) {
  replyTo.value = commentId;
  nextTick(() => {
    document.getElementById('reply-input').focus();
  });
}

watch(
  () => route.params.id,
  (id) => loadPost(id),
  { immediate: true }
);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, { language: lang }).value;
        return `<pre class="hljs"><div class="code-header"><span class="code-lang">${lang}</span><button class="copy-btn" data-code="${encodeURIComponent(str)}">copy</button></div><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      } catch (__) {}
    }
    return `<pre class="hljs"><div class="code-header"><button class="copy-btn" data-code="${encodeURIComponent(str)}">copy</button></div><code>${str}</code></pre>`;
  },
})
  .use(markdownItTaskLists, { enabled: true })
  .use(markdownItFootnote)
  .use(markdownItDeflist)
  .use(markdownItMark)
  .use(markdownItSub)
  .use(markdownItSup)
  .use(markdownItTexmath, {
    engine: katex,
    delimiters: "dollars",
    katexOptions: { throwOnError: false },
  });

const renderedHtml = computed(() => {
  if (!post.value?.content) return "";
  return DOMPurify.sanitize(md.render(post.value.content));
});

function copyToClipboard(button) {
  const code = button.dataset.code;
  if (code && !button.classList.contains("copied")) {
    navigator.clipboard.writeText(decodeURIComponent(code)).then(() => {
      button.textContent = "Copied!";
      button.classList.add("copied");
      setTimeout(() => {
        button.textContent = "copy";
        button.classList.remove("copied");
      }, 1000);
    }).catch(err => {
      console.error("Copy failed:", err);
    });
  }
}

function setupCopyButtons() {
  nextTick(() => {
    const buttons = document.querySelectorAll(".copy-btn");
    buttons.forEach(button => {
      button.removeEventListener("click", () => copyToClipboard(button));
      button.addEventListener("click", () => copyToClipboard(button));
    });
  });
}

watch(
  () => post.value,
  () => {
    setupCopyButtons();
  },
  { immediate: true }
);

let themeObserver = null;

onMounted(() => {
  setupCopyButtons();
  themeObserver = setupThemeWatcher();
});

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect();
  }
});
</script>

<template>
  <main class="container section read-page">
    <section v-if="post" class="panel read-panel">
      <header class="read-head">
        <h1>{{ post.title || "未命名题解" }}</h1>
        <p v-if="post.summary" class="read-summary">{{ post.summary }}</p>
        <div class="read-meta">
          <span>状态：{{ post.status === "published" ? "已发布" : "草稿" }}</span>
          <span>发布时间：{{ formatTime(post.publishedAt) }}</span>
          <span>更新时间：{{ formatTime(post.updatedAt) }}</span>
        </div>
        <div v-if="post.tags?.length" class="tag-list read-tags">
          <span v-for="tag in post.tags" :key="tag">{{ tag }}</span>
        </div>
      </header>
      <article class="markdown-preview" v-html="renderedHtml" ref="markdownPreview"></article>
    </section>

    <section v-else class="empty-state">
      文章不存在或已被删除。
    </section>

    <section v-if="post" class="panel comment-panel">
      <h2>评论区</h2>
      
      <!-- 评论表单 -->
      <div class="comment-form">
        <div class="form-group">
          <label for="author">昵称（可选）</label>
          <input 
            type="text" 
            id="author" 
            v-model="authorName" 
            placeholder="请输入您的昵称"
            class="form-input"
          />
        </div>
        <div class="form-group">
          <label for="comment">评论内容</label>
          <textarea 
            id="comment" 
            v-model="commentContent" 
            placeholder="写下您的评论..."
            rows="4"
            class="form-textarea"
          ></textarea>
        </div>
        <button 
          @click="submitComment" 
          class="btn btn-primary"
          :disabled="!commentContent.trim()"
        >
          发表评论
        </button>
      </div>

      <!-- 回复表单 -->
      <div v-if="replyTo" class="reply-form">
        <h3>回复评论</h3>
        <textarea 
          id="reply-input"
          v-model="replyContent" 
          placeholder="写下您的回复..."
          rows="3"
          class="form-textarea"
        ></textarea>
        <div class="reply-actions">
          <button 
            @click="replyTo = null; replyContent = ''" 
            class="btn btn-ghost"
          >
            取消
          </button>
          <button 
            @click="submitReply" 
            class="btn btn-primary"
            :disabled="!replyContent.trim()"
          >
            回复
          </button>
        </div>
      </div>

      <!-- 评论列表 -->
      <div class="comment-list">
        <h3>评论 ({{ comments.length }})</h3>
        <div v-if="comments.length === 0" class="empty-state">
          还没有评论，快来发表第一条评论吧！
        </div>
        <div v-else>
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-author">{{ comment.author }}</span>
              <span class="comment-time">{{ formatTime(comment.createdAt) }}</span>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
            <div class="comment-actions">
              <button @click="startReply(comment.id)" class="comment-action-btn">
                回复
              </button>
              <button @click="handleLike(comment.id)" class="comment-action-btn">
                点赞 ({{ comment.likes || 0 }})
              </button>
              <button @click="handleDelete(comment.id)" class="comment-action-btn">
                删除
              </button>
            </div>
            <!-- 回复列表 -->
            <div v-if="comment.replies && comment.replies.length > 0" class="reply-list">
              <div v-for="reply in comment.replies" :key="reply.id" class="reply-item">
                <div class="reply-header">
                  <span class="reply-author">{{ reply.author }}</span>
                  <span class="reply-time">{{ formatTime(reply.createdAt) }}</span>
                </div>
                <div class="reply-content">{{ reply.content }}</div>
                <div class="reply-actions">
                  <button @click="handleLike(reply.id)" class="comment-action-btn">
                    点赞 ({{ reply.likes || 0 }})
                  </button>
                  <button @click="handleDelete(reply.id)" class="comment-action-btn">
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>