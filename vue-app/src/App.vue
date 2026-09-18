<script setup>
import { computed, onErrorCaptured, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { pushToast, removeToast, toastList } from "./utils/toast";
import { applyHljsStylesheet } from "./utils/hljsTheme";
import { useAuth } from "./composables/useAuth";
import { usePermission } from "./composables/usePermission";
import { supabaseConfigured } from "./utils/supabase";

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

const { user, signOut } = useAuth();
const { isAdmin } = usePermission();
const canManage = computed(() => isAdmin.value || (import.meta.env.DEV && !supabaseConfigured));
const router = useRouter();
const themeSwitcherRef = ref(null);
const navDropdownOpen = ref(false);
const navDropdownRef = ref(null);
const mobileNavOpen = ref(false);
const mobileNavToggleRef = ref(null);
const headerNavRef = ref(null);
const loginTarget = computed(() => {
  const current = router.currentRoute.value.fullPath;
  return {
    name: "login",
    query: current === "/" ? {} : { next: current },
  };
});
const userLabel = computed(
  () => user.value?.user_metadata?.username || user.value?.email?.split("@")[0] || "已登录"
);

function toggleNavDropdown() {
  if (navDropdownOpen.value) {
    navDropdownOpen.value = false;
    router.push("/dp-optimization");
  } else {
    navDropdownOpen.value = true;
  }
}

function handleOutsideClick(event) {
  if (expanded.value && themeSwitcherRef.value && !themeSwitcherRef.value.contains(event.target)) {
    expanded.value = false;
  }
  if (navDropdownOpen.value && navDropdownRef.value && !navDropdownRef.value.contains(event.target)) {
    navDropdownOpen.value = false;
  }
  if (
    mobileNavOpen.value
    && headerNavRef.value
    && mobileNavToggleRef.value
    && !headerNavRef.value.contains(event.target)
    && !mobileNavToggleRef.value.contains(event.target)
  ) {
    mobileNavOpen.value = false;
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

watch(
  () => router.currentRoute.value.fullPath,
  () => {
    mobileNavOpen.value = false;
    navDropdownOpen.value = false;
    expanded.value = false;
  }
);

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

async function handleSignOut() {
  try {
    const wasAdminPage = Boolean(router.currentRoute.value.meta.requiresAdmin);
    await signOut();
    if (wasAdminPage) await router.replace("/");
  } catch (error) {
    pushToast(error?.message || "退出失败，请稍后重试", "error", 3200);
  }
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
      <button
        ref="mobileNavToggleRef"
        type="button"
        class="mobile-nav-toggle"
        :class="{ 'mobile-nav-toggle-open': mobileNavOpen }"
        :aria-expanded="mobileNavOpen"
        aria-controls="site-navigation"
        aria-label="切换主导航"
        @click="mobileNavOpen = !mobileNavOpen"
      >
        <span></span><span></span><span></span>
      </button>
      <nav
        id="site-navigation"
        ref="headerNavRef"
        class="header-nav"
        :class="{ 'mobile-nav-open': mobileNavOpen }"
        aria-label="主导航"
      >
        <ul class="nav-list">
          <li><RouterLink to="/">主页</RouterLink></li>
          <li class="nav-dropdown" ref="navDropdownRef">
            <button
              type="button"
              class="nav-dropdown-trigger"
              :class="{ 'nav-dropdown-open': navDropdownOpen }"
              @click="toggleNavDropdown"
            >
              专题
              <span class="nav-dropdown-arrow" :class="{ 'nav-dropdown-arrow-up': navDropdownOpen }">▾</span>
            </button>
            <ul v-if="navDropdownOpen" class="nav-dropdown-menu">
              <li><RouterLink to="/study-plan" @click="navDropdownOpen = false">学习计划</RouterLink></li>
              <li><RouterLink to="/dp-optimization" @click="navDropdownOpen = false">DP优化</RouterLink></li>
            </ul>
          </li>
          <li><RouterLink to="/cf-daily">CF统计</RouterLink></li>
          <li><RouterLink to="/solutions">题解</RouterLink></li>
          <li v-if="canManage"><RouterLink to="/admin/solutions">题解管理</RouterLink></li>
          <li v-if="canManage"><RouterLink to="/admin/journal">游记管理</RouterLink></li>
          <li><RouterLink to="/friends">友链</RouterLink></li>
        </ul>
        <div class="header-actions">
          <RouterLink v-if="!user" class="btn btn-ghost btn-sm" :to="loginTarget">
            登录
          </RouterLink>
          <div v-else class="user-menu">
            <span class="user-greeting">{{ userLabel }}</span>
            <button class="btn btn-ghost btn-sm" @click="handleSignOut">退出</button>
          </div>
        </div>
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
