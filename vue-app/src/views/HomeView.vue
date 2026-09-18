<script setup>
import { computed, onMounted, ref } from "vue";
import { getAllPosts, POST_KIND } from "../utils/postStorage";
import {
  DP_KNOWLEDGE_ARTICLE,
  isDpKnowledgePost,
} from "../content/dp-optimization";
const avatarUrl = "/images/avatar-usedchang.png";

const posts = ref([]);
const postsLoading = ref(true);
const postsError = ref("");

async function loadPosts() {
  postsLoading.value = true;
  postsError.value = "";
  try {
    posts.value = await getAllPosts();
  } catch (error) {
    postsError.value = error?.message || "读取文章失败";
    posts.value = [];
  } finally {
    postsLoading.value = false;
  }
}

onMounted(loadPosts);

const latestPublishedSolutions = computed(() =>
  posts.value
    .filter((post) => post.status === "published" && post.kind === POST_KIND.solution)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 3)
);

const latestPublishedJournals = computed(() =>
  posts.value
    .filter((post) => post.status === "published" && post.kind === POST_KIND.journal)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 3)
);

const latestPublishedKnowledge = computed(() =>
  posts.value
    .filter((post) => post.status === "published" && post.kind === POST_KIND.knowledge)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 3)
);

const homeKnowledgeCards = computed(() => {
  const latest = latestPublishedKnowledge.value;
  return latest.some(isDpKnowledgePost)
    ? latest
    : [DP_KNOWLEDGE_ARTICLE, ...latest].slice(0, 3);
});

const publishedPosts = computed(() =>
  (() => {
    if (postsLoading.value) return [];
    const list = posts.value.filter((post) => post.status === "published");
    return list.some(isDpKnowledgePost) ? list : [DP_KNOWLEDGE_ARTICLE, ...list];
  })()
);
const publishedKnowledgeCount = computed(() =>
  publishedPosts.value.filter((post) => post.kind === POST_KIND.knowledge).length
);
const publishedSolutionCount = computed(() =>
  publishedPosts.value.filter((post) => post.kind === POST_KIND.solution).length
);

function knowledgePath(post) {
  return post?.isBuiltin || isDpKnowledgePost(post)
    ? "/knowledge/dp-optimization"
    : `/posts/${post.id}`;
}
</script>

<template>
  <main>
    <section class="hero home-hero container" id="about">
      <div class="home-hero-copy">
        <div class="home-hero-eyebrow">
          <p class="hero-tag">USEDCHANG · XCPC BLOG</p>
          <span class="home-live-badge"><i aria-hidden="true"></i>持续更新</span>
        </div>
        <h1>憧憬成为人类的 xcpcer?</h1>
        <p class="hero-desc">
          这里记录算法成长轨迹：刷题、补题、题解与知识整理。把零散的思路沉淀下来，方便自己复盘，也方便与你交流。
        </p>
        <div class="home-hero-stats" aria-label="站点内容统计">
          <div class="home-stat">
            <strong>{{ publishedPosts.length }}</strong>
            <span>公开文章</span>
          </div>
          <div class="home-stat">
            <strong>{{ publishedKnowledgeCount }}</strong>
            <span>知识笔记</span>
          </div>
          <div class="home-stat">
            <strong>{{ publishedSolutionCount }}</strong>
            <span>题解</span>
          </div>
        </div>
        <div class="hero-profile">
          <img class="avatar" :src="avatarUrl" alt="usedchang avatar" />
          <div class="contact-list">
            <h3>usedchang</h3>
            <p>
              欢迎交流：
              <a href="mailto:24211860219@stu.wzu.edu.cn">24211860219@stu.wzu.edu.cn</a>
            </p>
            <p>
              GitHub：
              <a
                class="social-link"
                href="https://github.com/usedchang"
                target="_blank"
                rel="noopener noreferrer"
              >github.com/usedchang ↗</a>
            </p>
          </div>
        </div>
      </div>

      <aside class="home-quick-panel" aria-label="快捷入口">
        <p class="home-quick-kicker">QUICK ACCESS</p>
        <h2>现在想做什么？</h2>
        <p class="home-quick-desc">从一个入口开始，继续今天的训练。</p>
        <nav class="home-quick-list">
          <RouterLink class="home-quick-link" to="/knowledge/dp-optimization">
            <span class="home-quick-icon" aria-hidden="true">∑</span>
            <span class="home-quick-copy"><strong>动态规划优化</strong><small>六类常用优化方法</small></span>
            <span class="home-quick-arrow" aria-hidden="true">→</span>
          </RouterLink>
          <RouterLink class="home-quick-link" to="/study-plan">
            <span class="home-quick-icon" aria-hidden="true">✓</span>
            <span class="home-quick-copy"><strong>学习计划</strong><small>安排下一步训练任务</small></span>
            <span class="home-quick-arrow" aria-hidden="true">→</span>
          </RouterLink>
          <a
            class="home-quick-link"
            href="https://usedchang.github.io/xcpc-daily/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="home-quick-icon" aria-hidden="true">今</span>
            <span class="home-quick-copy"><strong>每日一题</strong><small>打开每日 XCPC 题单</small></span>
            <span class="home-quick-arrow" aria-hidden="true">↗</span>
          </a>
          <a
            class="home-quick-link"
            href="https://github.com/usedchang/XCPC-Template"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span class="home-quick-icon" aria-hidden="true">C++</span>
            <span class="home-quick-copy"><strong>模板库</strong><small>浏览竞赛代码模板</small></span>
            <span class="home-quick-arrow" aria-hidden="true">↗</span>
          </a>
        </nav>
        <a
          class="home-old-blog-link"
          href="https://www.cnblogs.com/usedchang"
          target="_blank"
          rel="noopener noreferrer"
        >
          访问博客园旧文章 <span aria-hidden="true">↗</span>
        </a>
      </aside>
    </section>

    <p v-if="postsError" class="container section auth-error">{{ postsError }}</p>
    <p v-else-if="postsLoading" class="container section comment-status">正在加载文章...</p>

    <template v-if="!postsLoading">
    <section class="container section" id="journal">
      <div class="section-title-row">
        <h2>最新游记</h2>
      </div>
      <div v-if="latestPublishedJournals.length" class="card-grid">
        <article v-for="item in latestPublishedJournals" :key="item.id" class="card">
          <p class="card-meta">
            游记 · {{ item.tags?.length ? item.tags.join(" / ") : "未打标签" }}
          </p>
          <h3>
            <RouterLink :to="`/posts/${item.id}`">
              {{ item.title || "未命名游记" }}
            </RouterLink>
          </h3>
          <p>{{ item.summary || "暂无摘要，点击阅读全文（支持评论）。" }}</p>
        </article>
      </div>
      <div v-else class="empty-state">还没有已发布游记，到「游记」里写一篇并发布吧。</div>
    </section>

    <section class="container section" id="solutions">
      <div class="section-title-row">
        <h2>最新题解</h2>
        <RouterLink class="section-link" to="/solutions">查看全部 →</RouterLink>
      </div>
      <div v-if="latestPublishedSolutions.length" class="card-grid">
        <article v-for="item in latestPublishedSolutions" :key="item.id" class="card">
          <p class="card-meta">
            题解 · {{ item.tags?.length ? item.tags.join(" / ") : "未分类" }}
          </p>
          <h3>
            <RouterLink :to="`/posts/${item.id}`">
              {{ item.title || "未命名题解" }}
            </RouterLink>
          </h3>
          <p>{{ item.summary || "暂无摘要，点击阅读完整题解。" }}</p>
        </article>
      </div>
      <div v-else class="empty-state">还没有已发布题解，内容正在整理中。</div>
    </section>

    <section class="container section" id="study">
      <div class="section-title-row">
        <h2>知识学习</h2>
        <RouterLink class="section-link" to="/knowledge">查看全部 →</RouterLink>
      </div>
      <div v-if="homeKnowledgeCards.length" class="card-grid">
        <article v-for="item in homeKnowledgeCards" :key="item.id" class="card home-content-card">
          <p class="card-meta">
            {{ item.isBuiltin ? "内置专题" : "知识学习" }} · {{ item.tags?.length ? item.tags.join(" / ") : "未分类" }}
          </p>
          <h3><RouterLink :to="knowledgePath(item)">{{ item.title || "未命名知识学习" }}</RouterLink></h3>
          <p>{{ item.summary || "暂无摘要，点击阅读完整笔记。" }}</p>
        </article>
      </div>
      <div v-else class="empty-state">知识学习文章正在整理中，先从 DP 优化专题开始。</div>
      <div class="tag-list">
        <span>图论</span>
        <span>字符串</span>
        <span>数据结构</span>
        <span>数学</span>
        <span>计算几何</span>
      </div>
    </section>

    <section class="container section" id="contests">
      <div class="section-title-row">
        <h2>比赛经历</h2>
      </div>
      <div class="contest-grid">
        <article class="contest-card contest-silver">
          <div class="contest-medal">🥈</div>
          <div class="contest-info">
            <h3>2026 贵州邀请赛</h3>
            <p class="contest-award">银牌</p>
            <p class="contest-team">队伍：炫彩猫猫</p>
          </div>
        </article>
        <article class="contest-card contest-bronze">
          <div class="contest-medal">🥉</div>
          <div class="contest-info">
            <h3>2026 浙江省赛</h3>
            <p class="contest-award">铜牌</p>
            <p class="contest-team">队伍：炫彩猫猫</p>
          </div>
        </article>
      </div>
    </section>
    </template>

  </main>
</template>
