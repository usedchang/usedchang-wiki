import { createClient } from "@supabase/supabase-js";

// `import.meta.env` 由 Vite 注入；在纯 Node 环境（单元测试）下为 undefined，
// 用 `|| {}` 兜底，避免导入阶段就抛错，同时让 setRemoteEnabled 能接管切换。
const env = import.meta.env || {};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

let remoteEnabled = !!(supabaseUrl && supabaseAnonKey);

/** 构建时是否配置了 Supabase（用于能力判断与提示文案）。 */
export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

/**
 * 运行时是否走远端存储。单元测试可用 setRemoteEnabled(false) 强制走 localStorage 分支，
 * 从而在不联网的前提下覆盖 postStorage 的读写逻辑。
 */
export function isRemoteEnabled() {
  return remoteEnabled;
}

/** 仅供单元测试。 */
export function setRemoteEnabled(enabled) {
  remoteEnabled = Boolean(enabled);
}

if (!supabaseConfigured) {
  console.warn(
    "Supabase 未配置：请在项目根目录 .env 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。认证与评论功能暂不可用。"
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
