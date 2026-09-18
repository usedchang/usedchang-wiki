<script setup>
import { computed, onMounted, ref } from "vue";
import { getAllPosts, POST_KIND } from "../utils/postStorage";
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
    .filter((post) => post.status === "published" && post.kind !== POST_KIND.journal)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 3)
);

const latestPublishedJournals = computed(() =>
  posts.value
    .filter((post) => post.status === "published" && post.kind === POST_KIND.journal)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
    .slice(0, 3)
);
</script>

<template>
  <main>
    <section class="hero container" id="about">
      <p class="hero-tag">USEDCHANG · XCPC BLOG</p>
      <h1>憧憬成为人类的 xcpcer?</h1>
      <p class="hero-desc">
        这里记录我的算法成长轨迹：刷题、补题、题解、知识整理。
      </p>
      <div class="hero-profile">
        <img
          class="avatar"
          :src="avatarUrl"
          alt="usedchang avatar"
        />
        <div class="contact-list">
          <h3>联系方式</h3>
          <p>
            邮箱：
            <a href="mailto:24211860219@stu.wzu.edu.cn"
              >24211860219@stu.wzu.edu.cn</a
            >
          </p>
        </div>
      </div>
      <div class="hero-actions">
        <a
          class="btn btn-primary"
          href="https://www.cnblogs.com/usedchang"
          target="_blank"
          rel="noopener noreferrer"
        >
          老博客地址（博客园）
        </a>
      </div>
    </section>

    <p v-if="postsError" class="container section auth-error">{{ postsError }}</p>
    <p v-else-if="postsLoading" class="container section comment-status">正在加载文章...</p>

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
      </div>
      <div class="card-grid">
        <article class="card">
          <p class="card-meta">Wiki · 算法</p>
          <h3>
            <RouterLink to="/dp-optimization">动态规划优化方法</RouterLink>
          </h3>
          <p>
            状态设计、前缀最值、数据结构、矩阵快速幂、位运算、卷积六类优化，系统笔记与代码模板。
          </p>
        </article>
      </div>
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

  </main>
</template>
