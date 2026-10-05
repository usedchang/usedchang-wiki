/**
 * 学习计划页的纯逻辑：日期与年月换算、三态循环、统计、阶段配色、存取解析。
 *
 * 单独抽出来是为了能被单元测试直接覆盖 —— 这些换算一旦错了（闰年天数、
 * 年月归属、进度折算、脏数据解析），肉眼很难发现，但会直接算错用户看到的数字。
 */

/**
 * 页面从「按周 + 题目列表」换成了「日期 × 三件事 × 三状态」的日程表，
 * 所以换了一个新存储键；旧键 usedchang-weekly-todos 原样留着，不读也不删。
 */
export const STUDY_PLAN_STORAGE_KEY = "usedchang-study-plan-v1";

/** 三个「事件」列与对应的状态列。 */
export const EVENT_FIELDS = ["e1", "e2", "e3"];
export const STATUS_FIELDS = ["s1", "s2", "s3"];

/** 点状态圆点时的循环顺序。 */
export const STATUS_CYCLE = ["", "ok", "part", "no"];

export const STATUS_ICON = { "": "", ok: "✓", part: "◐", no: "✗" };

export const STATUS_LABEL = {
  "": "未标记（点击切换）",
  ok: "已完成",
  part: "部分完成",
  no: "未完成",
};

/** 阶段色条用的固定调色板：它的职责是区分不同专题，所以不跟随站点主题。 */
export const STAGE_PALETTE = [
  "#5566ff",
  "#0ea5e9",
  "#12b3a0",
  "#a855f7",
  "#f97316",
  "#e11d48",
  "#65a30d",
  "#0891b2",
  "#7c3aed",
];

const FULL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHORT_DATE = /^(\d{1,2})-(\d{1,2})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

const pad2 = (value) => String(value).padStart(2, "0");

/** 一行 = 一天：完整日期 + 三件事 + 三个状态。 */
export function createRow(date = "") {
  return { date, e1: "", s1: "", e2: "", s2: "", e3: "", s3: "" };
}

/**
 * 今天，格式 YYYY-MM-DD。
 * 日期必须带年份：按年月归档、跨年查看都靠它，只存 MM-DD 是归不了档的。
 */
export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** 从 "YYYY-MM-DD" 取出年月 "YYYY-MM"；取不到返回空串。 */
export function monthOf(dateKey) {
  const match = FULL_DATE.exec(String(dateKey || ""));
  return match ? `${match[1]}-${match[2]}` : "";
}

/** 把 "2026-10" 显示成 "2026 年 10 月"。 */
export function formatMonthLabel(yearMonth) {
  const match = YEAR_MONTH.exec(String(yearMonth || ""));
  if (!match) return String(yearMonth || "");
  return `${match[1]} 年 ${Number(match[2])} 月`;
}

/**
 * 某个月里的每一天（"2026-10" → 2026-10-01 … 2026-10-31）。
 * 天数交给 Date 算，闰年二月自然是对的。
 */
export function daysInMonth(yearMonth) {
  const match = YEAR_MONTH.exec(String(yearMonth || ""));
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  // 「下个月的第 0 天」就是这个月的最后一天。
  const count = new Date(year, month, 0).getDate();
  if (!Number.isFinite(count) || count < 1) return [];
  return Array.from({ length: count }, (_, index) => `${match[1]}-${match[2]}-${pad2(index + 1)}`);
}

/** 把 "2026-10-05" 缩成 "10-05"，用来在表格里显示（年份已经在年月胶囊上）。 */
export function shortDate(dateKey) {
  const match = FULL_DATE.exec(String(dateKey || ""));
  return match ? `${match[2]}-${match[3]}` : String(dateKey || "");
}

/** 三态循环：未标记 → 完成 → 部分 → 未完成 → 未标记。不认识的输入当未标记。 */
export function nextStatus(current) {
  const index = STATUS_CYCLE.indexOf(current);
  const currentIndex = index < 0 ? 0 : index;
  return STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
}

/**
 * 统计：完成 / 部分 / 未完成 / 待完成 / 整体进度。
 * 进度按「完成 + 部分 × 0.5」折算。
 *
 * @param {Array} rows 有记录的那些天
 * @param {number} totalDays 这个月一共有多少天 —— 空格子也算「待完成」，
 *   所以分母用本月天数，而不是「已经记了几行」。
 */
export function computeStats(rows, totalDays = rows.length) {
  let ok = 0;
  let part = 0;
  let no = 0;
  for (const row of rows) {
    for (const field of STATUS_FIELDS) {
      const value = row[field];
      if (value === "ok") ok += 1;
      else if (value === "part") part += 1;
      else if (value === "no") no += 1;
    }
  }
  const total = totalDays * STATUS_FIELDS.length;
  return {
    total,
    ok,
    part,
    no,
    rest: total - ok - part - no,
    percent: total ? Math.round(((ok + part * 0.5) / total) * 100) : 0,
  };
}

/**
 * 按「事件三」的文本给每个阶段分配颜色，同一专题自动同色。
 * @returns {Map<string, string>} 专题名 → 颜色
 */
export function buildStageColors(rows) {
  const colors = new Map();
  for (const row of rows) {
    const stage = String(row.e3 || "").trim();
    if (stage && !colors.has(stage)) {
      colors.set(stage, STAGE_PALETTE[colors.size % STAGE_PALETTE.length]);
    }
  }
  return colors;
}

/**
 * 从 localStorage 恢复出「有记录的那些天」。
 *
 * 旧格式的日期只有 MM-DD，这里补上当前年份 —— 不补的话这些天既归不了档、
 * 也落不进任何一个月。补不出完整日期的脏数据直接丢弃。
 *
 * @returns {Array|null} 解析成功返回行数组，否则返回 null
 */
export function parsePlanRows(raw, now = new Date()) {
  if (typeof raw !== "string" || !raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.length) return null;

  const year = now.getFullYear();
  const rows = parsed
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const row = createRow();
      for (const key of ["date", ...EVENT_FIELDS, ...STATUS_FIELDS]) {
        if (typeof item[key] === "string") row[key] = item[key];
      }
      const short = SHORT_DATE.exec(row.date);
      if (short) row.date = `${year}-${pad2(short[1])}-${pad2(short[2])}`;
      if (!FULL_DATE.test(row.date)) row.date = "";
      // 状态只认三态里的值；旧版本遗留的 true / "done" 之类一律当未标记。
      for (const field of STATUS_FIELDS) {
        if (!STATUS_CYCLE.includes(row[field])) row[field] = "";
      }
      return row;
    })
    .filter((row) => row.date);

  return rows.length ? rows : null;
}
