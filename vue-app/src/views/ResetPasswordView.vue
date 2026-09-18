<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  useAuth,
} from "../composables/useAuth";
import { getSafeNextPath } from "../utils/authNavigation";

const route = useRoute();
const router = useRouter();
const { user, loading: authLoading, passwordRecovery, updatePassword, signOut } = useAuth();
const password = ref("");
const passwordConfirm = ref("");
const busy = ref(false);
const ready = ref(false);
const invalidLink = ref(false);
const passwordUpdated = ref(false);
const errorMessage = ref("");
const forgotPasswordTarget = computed(() => {
  const next = getSafeNextPath(route.query.next);
  return {
    name: "login",
    query: { mode: "forgot", ...(next === "/" ? {} : { next }) },
  };
});

watch(
  [authLoading, user, passwordRecovery],
  ([isLoading, currentUser, isRecovery]) => {
    if (isLoading) return;
    ready.value = Boolean(currentUser && isRecovery);
    invalidLink.value = !ready.value;
  },
  { immediate: true }
);

async function handleReset() {
  if (busy.value || !ready.value || passwordUpdated.value) return;
  errorMessage.value = "";
  if (password.value.length < PASSWORD_MIN_LENGTH || password.value.length > PASSWORD_MAX_LENGTH) {
    errorMessage.value = `密码长度应为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 个字符。`;
    return;
  }
  if (password.value !== passwordConfirm.value) {
    errorMessage.value = "两次输入的密码不一致。";
    return;
  }

  busy.value = true;
  try {
    await updatePassword(password.value);
    passwordUpdated.value = true;
    password.value = "";
    passwordConfirm.value = "";
    try {
      await signOut();
      const next = getSafeNextPath(route.query.next);
      await router.replace({
        name: "login",
        query: { ...(next === "/" ? {} : { next }), reset: "success" },
      });
    } catch {
      errorMessage.value = "密码已更新，但当前会话退出失败。请手动退出后再使用新密码登录。";
    }
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    errorMessage.value =
      message.includes("same password")
        ? "新密码不能与当前密码相同。"
        : "密码更新失败，链接可能已过期，请重新申请重置邮件。";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="container section auth-page">
    <section class="panel auth-card" aria-labelledby="reset-password-title">
      <RouterLink class="auth-brand" to="/">usedchang</RouterLink>
      <h1 id="reset-password-title">设置新密码</h1>

      <p v-if="authLoading" class="auth-sub">正在验证重置链接…</p>
      <template v-else-if="invalidLink">
        <p class="auth-message auth-error" role="alert">
          重置链接无效或已过期，请重新申请密码重置邮件。
        </p>
        <RouterLink class="btn btn-primary auth-btn" :to="forgotPasswordTarget">
          重新申请
        </RouterLink>
      </template>

      <form v-else class="auth-form" @submit.prevent="handleReset">
        <div class="form-group">
          <label for="new-password">新密码</label>
          <input
            id="new-password"
            v-model="password"
            class="form-input"
            type="password"
            autocomplete="new-password"
            :minlength="PASSWORD_MIN_LENGTH"
            :maxlength="PASSWORD_MAX_LENGTH"
            :disabled="busy || passwordUpdated"
            required
          />
          <p class="auth-field-hint">
            使用 {{ PASSWORD_MIN_LENGTH }}–{{ PASSWORD_MAX_LENGTH }} 个字符，且不要复用其他网站密码。
          </p>
        </div>
        <div class="form-group">
          <label for="new-password-confirm">确认新密码</label>
          <input
            id="new-password-confirm"
            v-model="passwordConfirm"
            class="form-input"
            type="password"
            autocomplete="new-password"
            :minlength="PASSWORD_MIN_LENGTH"
            :maxlength="PASSWORD_MAX_LENGTH"
            :disabled="busy || passwordUpdated"
            required
          />
        </div>
        <p v-if="errorMessage" class="auth-message auth-error" role="alert">
          {{ errorMessage }}
        </p>
        <button class="btn btn-primary auth-btn" type="submit" :disabled="busy || passwordUpdated">
          {{ busy ? "更新中..." : "更新密码" }}
        </button>
      </form>
    </section>
  </main>
</template>
