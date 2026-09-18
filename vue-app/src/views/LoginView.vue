<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  useAuth,
} from "../composables/useAuth";
import { buildAuthRedirect, getSafeNextPath } from "../utils/authNavigation";

const route = useRoute();
const router = useRouter();
const {
  user,
  loading: authLoading,
  signInWithPassword,
  signUpWithPassword,
  requestPasswordReset,
} = useAuth();

const allowedModes = new Set(["login", "register", "forgot"]);
const mode = ref(allowedModes.has(route.query.mode) ? route.query.mode : "login");
const email = ref("");
const username = ref("");
const password = ref("");
const passwordConfirm = ref("");
const busy = ref(false);
const errorMessage = ref("");
const successMessage = ref(
  route.query.reset === "success" ? "密码已更新，请使用新密码登录。" : ""
);

const nextPath = computed(() => getSafeNextPath(route.query.next));
const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()));

watch(
  () => route.query.mode,
  (value) => {
    if (allowedModes.has(value)) setMode(value);
  }
);

watch(
  [authLoading, user, busy],
  ([isLoading, currentUser, isBusy]) => {
    if (!isLoading && currentUser && !isBusy) router.replace(nextPath.value);
  },
  { immediate: true }
);

function setMode(nextMode) {
  mode.value = nextMode;
  password.value = "";
  passwordConfirm.value = "";
  errorMessage.value = "";
  successMessage.value = "";
}

function validatePassword(value) {
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return `密码长度应为 ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} 个字符`;
  }
  return "";
}

function authErrorMessage(action, error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("认证服务尚未配置")) return error.message;
  if (message.includes("rate limit") || message.includes("too many")) {
    return "操作过于频繁，请稍后再试。";
  }
  if (action === "login") return "登录失败，请检查邮箱和密码，并确认邮箱已验证。";
  if (action === "register" && message.includes("password")) {
    return "密码不符合站点安全策略，请换用更长且未泄露过的密码。";
  }
  if (action === "register") return "注册未完成，请检查输入或稍后再试。";
  return "重置邮件暂时无法发送，请稍后再试。";
}

async function handleLogin() {
  if (busy.value) return;
  errorMessage.value = "";
  successMessage.value = "";
  if (!emailValid.value) {
    errorMessage.value = "请输入有效的邮箱地址。";
    return;
  }
  if (!password.value) {
    errorMessage.value = "请输入密码。";
    return;
  }

  busy.value = true;
  try {
    await signInWithPassword(email.value, password.value);
    await router.replace(nextPath.value);
  } catch (error) {
    errorMessage.value = authErrorMessage("login", error);
  } finally {
    busy.value = false;
  }
}

async function handleRegister() {
  if (busy.value) return;
  errorMessage.value = "";
  successMessage.value = "";
  const displayName = username.value.trim();
  const displayNameLength = [...displayName].length;

  if (!displayName || displayNameLength > 32) {
    errorMessage.value = "显示名称长度应为 1–32 个字符。";
    return;
  }
  if (!emailValid.value) {
    errorMessage.value = "请输入有效的邮箱地址。";
    return;
  }
  const passwordError = validatePassword(password.value);
  if (passwordError) {
    errorMessage.value = passwordError;
    return;
  }
  if (password.value !== passwordConfirm.value) {
    errorMessage.value = "两次输入的密码不一致。";
    return;
  }

  busy.value = true;
  try {
    const redirectTo = buildAuthRedirect("/auth/callback", nextPath.value);
    const data = await signUpWithPassword(
      email.value,
      password.value,
      displayName,
      redirectTo
    );
    password.value = "";
    passwordConfirm.value = "";
    if (data.session) {
      await router.replace(nextPath.value);
    } else {
      successMessage.value =
        "注册请求已提交。如果该邮箱可用，你会收到确认邮件；确认后即可使用密码登录。";
    }
  } catch (error) {
    errorMessage.value = authErrorMessage("register", error);
  } finally {
    busy.value = false;
  }
}

async function handleForgotPassword() {
  if (busy.value) return;
  errorMessage.value = "";
  successMessage.value = "";
  if (!emailValid.value) {
    errorMessage.value = "请输入有效的邮箱地址。";
    return;
  }

  busy.value = true;
  try {
    const redirectTo = buildAuthRedirect("/reset-password", nextPath.value);
    await requestPasswordReset(email.value, redirectTo);
    successMessage.value =
      "如果该邮箱对应有效账号，你会收到密码重置邮件。请同时检查垃圾邮件箱。";
  } catch (error) {
    errorMessage.value = authErrorMessage("forgot", error);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="container section auth-page">
    <section class="panel auth-card" aria-labelledby="auth-page-title">
      <RouterLink class="auth-brand" to="/">usedchang</RouterLink>
      <h1 id="auth-page-title">
        {{ mode === "register" ? "创建账号" : mode === "forgot" ? "找回密码" : "账号登录" }}
      </h1>
      <p class="auth-sub">
        {{
          mode === "register"
            ? "邮箱用于登录，显示名称用于评论；两者互不替代。"
            : mode === "forgot"
              ? "输入注册邮箱，我们会发送一次性密码重置链接。"
              : "使用注册邮箱和密码登录；旧免密账号请先通过“忘记密码”设置初始密码。"
        }}
      </p>

      <div v-if="mode !== 'forgot'" class="auth-tabs" role="tablist" aria-label="登录方式">
        <button
          type="button"
          class="auth-tab"
          :class="{ active: mode === 'login' }"
          :aria-selected="mode === 'login'"
          role="tab"
          @click="setMode('login')"
        >
          登录
        </button>
        <button
          type="button"
          class="auth-tab"
          :class="{ active: mode === 'register' }"
          :aria-selected="mode === 'register'"
          role="tab"
          @click="setMode('register')"
        >
          注册
        </button>
      </div>

      <form
        class="auth-form"
        novalidate
        @submit.prevent="
          mode === 'login'
            ? handleLogin()
            : mode === 'register'
              ? handleRegister()
              : handleForgotPassword()
        "
      >
        <div v-if="mode === 'register'" class="form-group">
          <label for="register-username">显示名称</label>
          <input
            id="register-username"
            v-model="username"
            class="form-input"
            type="text"
            autocomplete="nickname"
            maxlength="32"
            :disabled="busy"
            placeholder="评论区显示的名称"
            required
          />
        </div>

        <div class="form-group">
          <label for="account-email">邮箱（登录账号）</label>
          <input
            id="account-email"
            v-model="email"
            class="form-input"
            type="email"
            inputmode="email"
            autocomplete="email"
            :disabled="busy"
            placeholder="name@example.com"
            required
          />
        </div>

        <div v-if="mode !== 'forgot'" class="form-group">
          <label for="account-password">密码</label>
          <input
            id="account-password"
            v-model="password"
            class="form-input"
            type="password"
            :autocomplete="mode === 'register' ? 'new-password' : 'current-password'"
            :minlength="mode === 'register' ? PASSWORD_MIN_LENGTH : undefined"
            :maxlength="PASSWORD_MAX_LENGTH"
            :disabled="busy"
            required
          />
          <p v-if="mode === 'register'" class="auth-field-hint">
            使用 {{ PASSWORD_MIN_LENGTH }}–{{ PASSWORD_MAX_LENGTH }} 个字符，建议交给密码管理器生成。
          </p>
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label for="account-password-confirm">确认密码</label>
          <input
            id="account-password-confirm"
            v-model="passwordConfirm"
            class="form-input"
            type="password"
            autocomplete="new-password"
            :minlength="PASSWORD_MIN_LENGTH"
            :maxlength="PASSWORD_MAX_LENGTH"
            :disabled="busy"
            required
          />
        </div>

        <p v-if="errorMessage" class="auth-message auth-error" role="alert">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="auth-message auth-message-success" role="status">
          {{ successMessage }}
        </p>

        <button class="btn btn-primary auth-btn" type="submit" :disabled="busy || authLoading">
          {{
            busy
              ? "处理中..."
              : mode === "register"
                ? "创建账号"
                : mode === "forgot"
                  ? "发送重置邮件"
                  : "登录"
          }}
        </button>
      </form>

      <div class="auth-links">
        <button v-if="mode === 'login'" type="button" class="auth-link" @click="setMode('forgot')">
          忘记密码？
        </button>
        <button v-else-if="mode === 'forgot'" type="button" class="auth-link" @click="setMode('login')">
          返回登录
        </button>
      </div>
    </section>
  </main>
</template>
