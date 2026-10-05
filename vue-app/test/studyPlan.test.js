import assert from "node:assert/strict";
import test from "node:test";
import {
  STAGE_PALETTE,
  buildStageColors,
  computeStats,
  createRow,
  daysInMonth,
  formatMonthLabel,
  monthOf,
  nextStatus,
  parsePlanRows,
  shortDate,
  todayKey,
} from "../src/utils/studyPlan.js";

test("formats today as a full date carrying the year", () => {
  assert.equal(todayKey(new Date(2026, 9, 5)), "2026-10-05");
  assert.equal(todayKey(new Date(2026, 0, 1)), "2026-01-01");
  assert.equal(todayKey(new Date(2027, 11, 31)), "2027-12-31");
});

test("derives the year-month a date belongs to", () => {
  assert.equal(monthOf("2026-10-05"), "2026-10");
  assert.equal(monthOf("2027-01-31"), "2027-01");
  // 没有年份的短日期归不了档
  assert.equal(monthOf("10-05"), "");
  assert.equal(monthOf(""), "");
  assert.equal(monthOf(null), "");
});

test("labels a year-month for display", () => {
  assert.equal(formatMonthLabel("2026-10"), "2026 年 10 月");
  assert.equal(formatMonthLabel("2026-01"), "2026 年 1 月");
  assert.equal(formatMonthLabel("乱码"), "乱码");
});

test("shortens a date to month-day for the table", () => {
  assert.equal(shortDate("2026-10-05"), "10-05");
  assert.equal(shortDate("2026-12-25"), "12-25");
  assert.equal(shortDate("坏值"), "坏值");
});

test("lists every day of a month, including a leap February", () => {
  const october = daysInMonth("2026-10");
  assert.equal(october.length, 31);
  assert.equal(october[0], "2026-10-01");
  assert.equal(october[30], "2026-10-31");

  assert.equal(daysInMonth("2026-11").length, 30);
  assert.equal(daysInMonth("2026-02").length, 28);
  // 2028 是闰年
  assert.equal(daysInMonth("2028-02").length, 29);
  assert.equal(daysInMonth("2028-02")[28], "2028-02-29");

  assert.deepEqual(daysInMonth("乱码"), []);
  assert.deepEqual(daysInMonth(""), []);
});

test("cycles the status through all four states", () => {
  assert.equal(nextStatus(""), "ok");
  assert.equal(nextStatus("ok"), "part");
  assert.equal(nextStatus("part"), "no");
  assert.equal(nextStatus("no"), "");
});

test("an unrecognised status is treated as unmarked, so one click marks it done", () => {
  assert.equal(nextStatus("done"), "ok");
  assert.equal(nextStatus(undefined), "ok");
  assert.equal(nextStatus(true), "ok");
});

test("counts the whole month as the denominator, not just the recorded days", () => {
  // 只记了两天，但要按 31 天算 —— 没记的那些天属于「待完成」。
  const rows = [
    { ...createRow("2026-10-01"), s1: "ok", s2: "ok", s3: "ok" },
    { ...createRow("2026-10-02"), s1: "part", s2: "no", s3: "" },
  ];
  const stats = computeStats(rows, 31);
  assert.equal(stats.total, 93);
  assert.equal(stats.ok, 3);
  assert.equal(stats.part, 1);
  assert.equal(stats.no, 1);
  assert.equal(stats.rest, 88);
  // (3 + 1 × 0.5) / 93 = 3.76% → 4%
  assert.equal(stats.percent, 4);
});

test("falls back to the recorded day count when the month length is omitted", () => {
  const stats = computeStats([{ ...createRow("2026-10-01"), s1: "ok" }]);
  assert.equal(stats.total, 3);
});

test("reports zero progress instead of NaN for an empty plan", () => {
  const stats = computeStats([], 31);
  assert.equal(stats.ok, 0);
  assert.equal(stats.rest, 93);
  assert.equal(stats.percent, 0);
  assert.equal(Number.isNaN(stats.percent), false);
});

test("gives the same stage the same colour and skips blanks", () => {
  const rows = [
    { ...createRow("2026-10-01"), e3: "莫队大学习" },
    { ...createRow("2026-10-02"), e3: "线性基大学习" },
    { ...createRow("2026-10-03"), e3: "莫队大学习" },
    { ...createRow("2026-10-04"), e3: "   " },
  ];
  const colors = buildStageColors(rows);
  assert.equal(colors.size, 2);
  assert.equal(colors.get("莫队大学习"), STAGE_PALETTE[0]);
  assert.equal(colors.get("线性基大学习"), STAGE_PALETTE[1]);
  assert.equal(colors.has(""), false);
});

test("upgrades legacy MM-DD dates by filling in the current year", () => {
  const rows = parsePlanRows(
    JSON.stringify([{ date: "10-05", e1: "每日一题", s1: "ok", e2: "abc280", s2: "" }]),
    new Date(2026, 9, 1)
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2026-10-05");
  assert.equal(monthOf(rows[0].date), "2026-10");
  assert.equal(rows[0].e1, "每日一题");
  assert.equal(rows[0].s1, "ok");
});

test("keeps full dates untouched and drops rows with no usable date", () => {
  const rows = parsePlanRows(
    JSON.stringify([
      { date: "2027-03-09", e1: "保留" },
      { date: "不是日期", e1: "丢掉" },
      { e1: "没有日期" },
    ]),
    new Date(2026, 9, 1)
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].date, "2027-03-09");
  assert.equal(rows[0].e1, "保留");
});

test("rejects dirty storage but still repairs the fields it can", () => {
  assert.equal(parsePlanRows(null), null);
  assert.equal(parsePlanRows(""), null);
  assert.equal(parsePlanRows("不是 JSON"), null);
  assert.equal(parsePlanRows("[]"), null);

  const rows = parsePlanRows(
    JSON.stringify([
      { date: "1-9", e1: "保留", s1: "ok", e2: 42, s2: "bogus", e3: null, s3: true },
    ]),
    new Date(2026, 9, 1)
  );
  assert.equal(rows.length, 1);
  // 短日期补零并补年
  assert.equal(rows[0].date, "2026-01-09");
  assert.equal(rows[0].e1, "保留");
  assert.equal(rows[0].s1, "ok");
  // 非字符串字段被丢弃，不认识的状态退回未标记
  assert.equal(rows[0].e2, "");
  assert.equal(rows[0].s2, "");
  assert.equal(rows[0].e3, "");
  assert.equal(rows[0].s3, "");
});
