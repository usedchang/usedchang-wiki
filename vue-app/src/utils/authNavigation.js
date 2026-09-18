const AUTH_ONLY_PATHS = new Set(["/login", "/auth/callback", "/reset-password"]);
const AUTH_REDIRECT_PATHS = new Set(["/auth/callback", "/reset-password"]);

/**
 * 只接受本站绝对路径，防止登录后被 next 参数重定向到外部网站。
 */
export function getSafeNextPath(rawValue, fallback = "/") {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const base = "https://local.invalid";
    const parsed = new URL(value, base);
    const normalizedPath =
      parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, "") : parsed.pathname;
    if (parsed.origin !== base || AUTH_ONLY_PATHS.has(normalizedPath)) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildAuthRedirect(path, nextPath) {
  if (!AUTH_REDIRECT_PATHS.has(path)) {
    throw new Error("不允许的认证回调路径");
  }
  const url = new URL(path, window.location.origin);
  const safeNext = getSafeNextPath(nextPath);
  if (safeNext !== "/") url.searchParams.set("next", safeNext);
  return url.toString();
}
