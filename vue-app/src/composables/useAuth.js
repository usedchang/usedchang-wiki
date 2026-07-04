import { ref, readonly } from "vue";
import { supabase } from "../utils/supabase";

// ── 单例状态（多组件共享同一份认证状态） ──
const user = ref(null);
const loading = ref(true);
const initialized = ref(false);
const authModalOpen = ref(false);

function openAuthModal() {
  authModalOpen.value = true;
}

function closeAuthModal() {
  authModalOpen.value = false;
}

/**
 * 发送邮箱验证码（OTP）
 * 用户不存在会自动创建，存在则直接发送验证码
 */
async function sendOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw error;
  return true;
}

/**
 * 验证 OTP 并完成登录
 */
async function verifyOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw error;
  return data;
}

/**
 * 退出登录
 */
async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * 获取当前 session（用于判断登录态是否有效）
 */
async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * 更新用户名
 */
async function updateUsername(username) {
  if (!user.value) throw new Error("请先登录");
  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.value.id);
  if (error) throw error;
  // 更新本地
  user.value = { ...user.value, username };
}

/**
 * 初始化：恢复 session + 监听认证状态变更
 */
function initAuth() {
  if (initialized.value) return;
  initialized.value = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    user.value = session?.user ?? null;
    loading.value = false;
  }).catch(() => {
    // Supabase 未配置或网络不通时静默降级
    console.warn("Supabase 连接失败，认证功能不可用");
    user.value = null;
    loading.value = false;
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null;
    loading.value = false;
  });
}

export function useAuth() {
  // 首次调用时自动初始化
  initAuth();

  return {
    user: readonly(user),
    loading: readonly(loading),
    authModalOpen: readonly(authModalOpen),
    openAuthModal,
    closeAuthModal,
    sendOtp,
    verifyOtp,
    signOut,
    getSession,
    updateUsername,
  };
}
