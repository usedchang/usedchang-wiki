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

/**
 * 创建 Supabase 客户端。
 *
 * @supabase/realtime-js 在**构造 RealtimeClient 时**就会解析 WebSocket 实现，
 * 而原生 `WebSocket` 是 Node 21+ 才有的全局对象。本模块被 postStorage 等
 * 在导入链路里引用，因此在 Node 20 上运行 `npm test` 时会在导入阶段直接抛
 * 「Node.js detected but native WebSocket not found.」，导致相关测试文件整体加载失败。
 *
 * 浏览器与 Node 22+ 下 `globalThis.WebSocket` 存在，走默认分支，
 * 实时订阅行为与改动前完全一致。
 */
function createSupabaseClient(url, key) {
  const options = {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  };
  if (!globalThis.WebSocket) {
    // 仅在缺少原生 WebSocket 的环境（Node 20 等）生效。
    // 该环境下测试只覆盖 localStorage 分支，不会真正建立实时连接，
    // 因此这个占位构造器不会被实例化。
    options.realtime = { transport: class UnsupportedWebSocket {} };
  }
  return createClient(url, key, options);
}

export const supabase = createSupabaseClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);
