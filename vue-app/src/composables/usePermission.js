import { computed, ref, watch, readonly } from "vue";
import { useAuth } from "./useAuth";
import { supabase } from "../utils/supabase";

// ── 单例权限状态 ──
const role = ref(null);
const loading = ref(true);
let requestId = 0;

const { user } = useAuth();

/**
 * 只询问数据库“当前 JWT 是否为管理员”。
 * role 列不再暴露给浏览器，真正权限仍由 RLS 决定。
 */
export async function checkIsAdmin() {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(`获取用户权限失败：${error.message}`);
  return data === true;
}

watch(
  user,
  async (newUser) => {
    const currentRequest = ++requestId;
    if (!newUser) {
      role.value = null;
      loading.value = false;
      return;
    }

    // 切换账号时先清空旧角色，避免新请求完成前短暂沿用上一个账号的管理员 UI。
    role.value = null;
    loading.value = true;
    try {
      const admin = await checkIsAdmin();
      if (currentRequest === requestId) role.value = admin ? "admin" : "user";
    } catch (error) {
      // 权限查询失败时必须 fail closed，不能沿用上一个账号的管理员状态。
      console.warn(error?.message || "获取用户权限失败");
      if (currentRequest === requestId) role.value = "user";
    } finally {
      if (currentRequest === requestId) loading.value = false;
    }
  },
  { immediate: true }
);

export function usePermission() {
  return {
    role: readonly(role),
    isAdmin: computed(() => role.value === "admin"),
    loading: readonly(loading),
  };
}
