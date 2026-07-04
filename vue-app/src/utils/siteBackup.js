const POSTS_KEY = "usedchang-posts";
const COMMENTS_KEY = "usedchang-comments";

const BACKUP_VERSION = 1;

/**
 * 下载当前 localStorage 中的文章与评论（JSON），便于离线备份。
 */
export function exportSiteData() {
  let posts = [];
  let comments = [];
  try {
    posts = JSON.parse(localStorage.getItem(POSTS_KEY) || "[]");
    if (!Array.isArray(posts)) posts = [];
  } catch {
    posts = [];
  }
  try {
    comments = JSON.parse(localStorage.getItem(COMMENTS_KEY) || "[]");
    if (!Array.isArray(comments)) comments = [];
  } catch {
    comments = [];
  }

  const payload = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    posts,
    comments,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const day = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `usedchang-wiki-backup-${day}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 从备份文件恢复（会覆盖现有文章与评论）。
 * @param {File} file
 */
export async function importSiteDataFromFile(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("不是有效的 JSON 文件");
  }
  if (!data || typeof data !== "object") throw new Error("备份格式无效");
  if (!Array.isArray(data.posts)) throw new Error("备份中缺少 posts 数组");
  if (data.comments != null && !Array.isArray(data.comments)) {
    throw new Error("备份中 comments 必须是数组");
  }

  localStorage.setItem(POSTS_KEY, JSON.stringify(data.posts));
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(Array.isArray(data.comments) ? data.comments : []));
}
