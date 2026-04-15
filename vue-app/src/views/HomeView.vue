<script setup>
import { computed } from "vue";
import { getAllPosts } from "../utils/postStorage";

const avatarUrl = "/images/avatar-usedchang.png";

const latestPublishedPosts = computed(() =>
  getAllPosts()
    .filter((post) => post.status === "published")
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
        <a class="btn btn-primary" href="#solutions">查看最新题解</a>
        <RouterLink class="btn btn-ghost" to="/study-plan">进入学习计划</RouterLink>
        <RouterLink class="btn btn-ghost" to="/cf-daily">查看 CF 每日统计</RouterLink>
        <RouterLink class="btn btn-ghost" to="/solutions">写题解</RouterLink>
      </div>
    </section>

    <section class="container section" id="solutions">
      <div class="section-title-row">
        <h2>最新题解</h2>
        <RouterLink class="section-link" to="/solutions">查看全部</RouterLink>
      </div>
      <div v-if="latestPublishedPosts.length" class="card-grid">
        <article v-for="item in latestPublishedPosts" :key="item.id" class="card">
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
      <div v-else class="empty-state">还没有已发布题解，先去写一篇并发布吧。</div>
    </section>

    <section class="container section" id="study">
      <div class="section-title-row">
        <h2>知识学习</h2>
      </div>
      <div class="tag-list">
        <span>动态规划</span>
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
      <div class="empty-state">
        暂缺。未来会在这里更新 ICPC / CCPC / 省赛 / 比赛记录与总结。
      </div>
    </section>
  </main>
</template>
