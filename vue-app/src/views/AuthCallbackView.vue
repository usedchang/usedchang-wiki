<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";
import { getSafeNextPath } from "../utils/authNavigation";

const route = useRoute();
const router = useRouter();
const { user, loading } = useAuth();
const state = ref("loading");
let settled = false;

const nextPath = computed(() => getSafeNextPath(route.query.next));
const loginTarget = computed(() => ({
  name: "login",
  query: nextPath.value === "/" ? {} : { next: nextPath.value },
}));

function callbackContainsError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return Boolean(route.query.error || route.query.error_description || hash.get("error"));
}

watch(
  [loading, user],
  async ([isLoading, currentUser]) => {
    if (settled || isLoading) return;
    if (callbackContainsError() || !currentUser) {
      settled = true;
      state.value = "error";
      return;
    }

    settled = true;
    state.value = "success";
    await router.replace(nextPath.value);
  },
  { immediate: true }
);
</script>

<template>
  <main class="container section auth-page">
    <section class="panel auth-card auth-state-card">
      <p class="auth-state-code">AUTH</p>
      <h1>{{ state === "error" ? "确认链接无效" : state === "success" ? "验证完成" : "正在验证账号" }}</h1>
      <p v-if="state === 'loading'" class="auth-sub">正在安全恢复登录会话，请稍候…</p>
      <template v-else-if="state === 'error'">
        <p class="auth-sub">链接可能已过期、已使用，或不属于当前浏览器。请重新登录或再次注册。</p>
        <RouterLink class="btn btn-primary auth-btn" :to="loginTarget">返回登录</RouterLink>
      </template>
      <p v-else class="auth-sub">正在返回原页面…</p>
    </section>
  </main>
</template>
