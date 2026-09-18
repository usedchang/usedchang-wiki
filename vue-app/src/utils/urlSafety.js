/**
 * Only return absolute HTTP(S) URLs that are safe to place in an external link.
 */
export function getSafeExternalUrl(rawValue) {
  if (typeof rawValue !== "string") return "";
  const value = rawValue.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
