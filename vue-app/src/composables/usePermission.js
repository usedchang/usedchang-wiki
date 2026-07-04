import { computed, ref, watch, readonly } from "vue";
import { useAuth } from "./useAuth";
import { supabase } from "../utils/supabase";

// ── 单例权限状态 ──
const role = ref(null);
const loading = ref(true);
let lastUserId = null;

const { user } = useAuth();

watch(
  user,
  (newUser) => {
    // 用户未变化，跳过
    if (newUser?.id === lastUserId) return;
    lastUserId = newUser?.id ?? null;

    if (!newUser) {
      role.value = null;
      loading.value = false;
      return;
    }

    loading.value = true;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", newUser.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.warn("获取用户权限失败:", error.message);
          role.value = "user";
        } else {
          role.value = data?.role || "user";
        }
      })
      .finally(() => {
        loading.value = false;
      });
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
