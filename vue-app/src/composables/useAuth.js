import { ref, readonly } from "vue";
import { supabase, supabaseConfigured } from "../utils/supabase";

// ── 单例状态（多组件共享同一份认证状态） ──
const user = ref(null);
const loading = ref(true);
const initialized = ref(false);
const passwordRecovery = ref(false);

const RECOVERY_SESSION_KEY = "usedchang-password-recovery-user";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

function ensureAuthAvailable() {
  if (!supabaseConfigured) {
    throw new Error("认证服务尚未配置，请联系站点管理员");
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getRecoveryUserId() {
  try {
    return sessionStorage.getItem(RECOVERY_SESSION_KEY);
  } catch {
    return null;
  }
}

function setRecoveryUserId(userId) {
  passwordRecovery.value = Boolean(userId);
  try {
    if (userId) sessionStorage.setItem(RECOVERY_SESSION_KEY, userId);
    else sessionStorage.removeItem(RECOVERY_SESSION_KEY);
  } catch {
    // 禁用 sessionStorage 时仍保留当前页面内的恢复状态。
  }
}

/**
 * 邮箱作为登录账号，密码只交给 Supabase Auth，绝不写入 profiles。
 */
async function signInWithPassword(email, password) {
  ensureAuthAvailable();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
  if (error) throw error;
  return data;
}

async function signUpWithPassword(email, password, username, redirectTo) {
  ensureAuthAvailable();
  const options = {
    data: { username: String(username || "").trim() },
  };
  if (redirectTo) options.emailRedirectTo = redirectTo;

  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options,
  });
  if (error) throw error;
  return data;
}

async function requestPasswordReset(email, redirectTo) {
  ensureAuthAvailable();
  const options = redirectTo ? { redirectTo } : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmail(email),
    options
  );
  if (error) throw error;
}

async function updatePassword(password) {
  ensureAuthAvailable();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

/**
 * 退出登录
 */
async function signOut() {
  ensureAuthAvailable();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * 更新用户名
 */
async function updateUsername(username) {
  ensureAuthAvailable();
  if (!user.value) throw new Error("请先登录");
  const value = String(username || "").trim();
  if (!value || value.length > 32) throw new Error("用户名长度应为 1–32 个字符");
  const { error } = await supabase
    .from("profiles")
    .update({ username: value })
    .eq("id", user.value.id);
  if (error) throw error;
  user.value = { ...user.value, username: value };
}

/**
 * 初始化：恢复 session + 监听认证状态变更
 */
function initAuth() {
  if (initialized.value) return;
  initialized.value = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    user.value = session?.user ?? null;
    passwordRecovery.value = Boolean(
      session?.user?.id && getRecoveryUserId() === session.user.id
    );
    loading.value = false;
  }).catch(() => {
    // Supabase 未配置或网络不通时静默降级
    console.warn("Supabase 连接失败，认证功能不可用");
    user.value = null;
    loading.value = false;
  });

  supabase.auth.onAuthStateChange((event, session) => {
    user.value = session?.user ?? null;
    if (event === "PASSWORD_RECOVERY" && session?.user?.id) {
      setRecoveryUserId(session.user.id);
    } else if (
      event === "SIGNED_OUT" ||
      (session?.user?.id && getRecoveryUserId() !== session.user.id)
    ) {
      setRecoveryUserId(null);
    }
    loading.value = false;
  });
}

export function useAuth() {
  // 首次调用时自动初始化
  initAuth();

  return {
    user: readonly(user),
    loading: readonly(loading),
    passwordRecovery: readonly(passwordRecovery),
    signInWithPassword,
    signUpWithPassword,
    requestPasswordReset,
    updatePassword,
    signOut,
    updateUsername,
  };
}
