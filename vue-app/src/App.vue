<script setup>
import { computed, onErrorCaptured, onMounted, onUnmounted, ref, watch } from "vue";
import { removeToast, toastList } from "./utils/toast";
import { applyHljsStylesheet } from "./utils/hljsTheme";

const THEME_KEY = "usedchang-theme";
const theme = ref("academic");
const expanded = ref(false);
const themeOptions = [
  { id: "academic", label: "Academic", subLabel: "Clean Academic" },
  { id: "modern", label: "Modern", subLabel: "Modern Glass" },
  { id: "dark", label: "深色", subLabel: "Focus Dark" },
  { id: "eyecare", label: "护眼", subLabel: "Eye-Care Soft" },
];

function applyTheme(nextTheme) {
  document.documentElement.setAttribute("data-theme", nextTheme);
}

const currentTheme = computed(
  () => themeOptions.find((option) => option.id === theme.value) || themeOptions[0]
);
const appError = ref("");

const themeSwitcherRef = ref(null);

function handleOutsideClick(event) {
  if (expanded.value && themeSwitcherRef.value && !themeSwitcherRef.value.contains(event.target)) {
    expanded.value = false;
  }
}

onMounted(() => {
  const saved = localStorage.getItem(THEME_KEY);
  if (themeOptions.some((option) => option.id === saved)) {
    theme.value = saved;
  }
  applyTheme(theme.value);
  applyHljsStylesheet(theme.value);
  document.addEventListener("click", handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleOutsideClick);
});

watch(theme, (value) => {
  localStorage.setItem(THEME_KEY, value);
  applyTheme(value);
  applyHljsStylesheet(value);
});

function toggleThemeMenu() {
  expanded.value = !expanded.value;
}

function selectTheme(nextTheme) {
  if (nextTheme !== theme.value) {
    theme.value = nextTheme;
  }
  expanded.value = false;
}

function resetAppError() {
  appError.value = "";
}

onErrorCaptured((error) => {
  appError.value = error instanceof Error ? error.message : "页面渲染异常";
  return false;
});
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink class="brand" to="/">usedchang</RouterLink>
      <nav class="header-nav" aria-label="主导航">
        <ul class="nav-list">
          <li><RouterLink to="/">主页</RouterLink></li>
          <li><RouterLink to="/study-plan">学习计划</RouterLink></li>
          <li><RouterLink to="/cf-daily">CF统计</RouterLink></li>
          <li><RouterLink to="/solutions">题解编辑</RouterLink></li>
          <li><RouterLink to="/journal">游记</RouterLink></li>
          <li><RouterLink to="/friends">友链</RouterLink></li>
        </ul>
        <div class="theme-switcher" ref="themeSwitcherRef">
          <button
            class="theme-btn"
            :class="{ 'theme-btn-active': true }"
            @click="toggleThemeMenu"
          >
            <span class="theme-dot" :class="`theme-dot-${currentTheme.id}`"></span>
            <span>{{ currentTheme.label }}</span>
          </button>
          <div v-if="expanded" class="theme-menu">
            <button
              v-for="option in themeOptions"
              :key="option.id"
              class="theme-btn theme-menu-item"
              :class="{ 'theme-menu-item-active': option.id === theme }"
              @click="selectTheme(option.id)"
            >
              <span class="theme-dot" :class="`theme-dot-${option.id}`"></span>
              <span class="theme-menu-text">
                <strong>{{ option.label }}</strong>
                <small>{{ option.subLabel }}</small>
              </span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  </header>

  <main v-if="appError" class="container section">
    <section class="panel app-error-panel">
      <p class="app-error-code">ERROR</p>
      <h2>页面出现异常</h2>
      <p class="app-error-text">请刷新页面重试。若仍失败，可先返回首页继续浏览。</p>
      <p class="app-error-detail">错误信息：{{ appError }}</p>
      <div class="card-actions">
        <button class="btn btn-primary" @click="resetAppError">重试渲染</button>
        <RouterLink class="btn btn-ghost" to="/">返回首页</RouterLink>
      </div>
    </section>
  </main>
  <RouterView v-else />

  <div class="toast-stack" aria-live="polite" aria-atomic="true">
    <article
      v-for="item in toastList"
      :key="item.id"
      class="toast-item"
      :class="`toast-${item.type}`"
    >
      <p>{{ item.message }}</p>
      <button class="toast-close" @click="removeToast(item.id)">×</button>
    </article>
  </div>

  <footer class="site-footer">
    <div class="container footer-inner">
      <p>© 2026 usedchang · Keep coding for XCPC.</p>
    </div>
  </footer>
</template>