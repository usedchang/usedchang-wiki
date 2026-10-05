<script setup>
import { computed, nextTick, ref, watch } from "vue";
import {
  EVENT_FIELDS,
  STATUS_FIELDS,
  STATUS_ICON,
  STATUS_LABEL,
  STUDY_PLAN_STORAGE_KEY,
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
} from "../utils/studyPlan";

const today = todayKey();
const todayMonth = monthOf(today);

function loadRows() {
  let raw = null;
  try {
    raw = localStorage.getItem(STUDY_PLAN_STORAGE_KEY);
  } catch {
    // 隐私模式等场景下 localStorage 可能直接抛错，退回空计划即可。
  }
  return parsePlanRows(raw) || [];
}

const rows = ref(loadRows());
const activeMonth = ref(todayMonth);

watch(
  rows,
  (value) => {
    try {
      localStorage.setItem(STUDY_PLAN_STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* 存不进去也不该打断编辑 */
    }
  },
  { deep: true }
);

/** 日期 → 记录。表格里每一天都要查一次，所以先建索引。 */
const dayIndex = computed(() => {
  const index = new Map();
  for (const row of rows.value) index.set(row.date, row);
  return index;
});

/**
 * 可选年月 = 记过东西的月份 ∪ 今天所在的月 ∪ 当前正在看的月，
 * 新的排在前面。这样归档过哪几个月一眼就能看到。
 */
const monthOptions = computed(() => {
  const months = new Set(rows.value.map((row) => monthOf(row.date)).filter(Boolean));
  months.add(todayMonth);
  months.add(activeMonth.value);
  return [...months].sort().reverse();
});

/** 当前这个月的每一天 —— 表格是按天铺开的，不是按「记过的行」。 */
const monthDates = computed(() => daysInMonth(activeMonth.value));

/** 本月里已经记过的那些天；统计与阶段配色只关心它们。 */
const monthRows = computed(() =>
  monthDates.value.map((date) => dayIndex.value.get(date)).filter(Boolean)
);

const stats = computed(() => computeStats(monthRows.value, monthDates.value.length));
const stageColors = computed(() => buildStageColors(monthRows.value));

const statCards = computed(() => [
  { label: "本月天数", value: String(monthDates.value.length), unit: "天" },
  { label: "已完成", value: `${stats.value.ok} / ${stats.value.total}` },
  { label: "部分完成", value: String(stats.value.part) },
  { label: "未完成", value: String(stats.value.no) },
  { label: "待完成", value: String(stats.value.rest) },
]);

function cellText(date, field) {
  return dayIndex.value.get(date)?.[field] ?? "";
}

function statusOf(date, field) {
  return dayIndex.value.get(date)?.[field] ?? "";
}

function stageColorFor(date) {
  const row = dayIndex.value.get(date);
  if (!row) return "transparent";
  return stageColors.value.get(String(row.e3 || "").trim()) || "transparent";
}

/**
 * 取某天的记录；这天还没记过就现建一条。
 * 只有真的动手编辑了才会落盘 —— 铺开整月时不会凭空生成一堆空记录。
 */
function ensureRow(date) {
  const existing = dayIndex.value.get(date);
  if (existing) return existing;
  const row = createRow(date);
  rows.value = [...rows.value, row].sort((a, b) => a.date.localeCompare(b.date));
  return row;
}

/**
 * contenteditable 的输入：原样落进数据，不做 trim。
 * 一 trim，数据就和 DOM 里的文本不一致，Vue 会回写文本节点，光标立刻跳到末尾。
 */
function onCellInput(event, date, field) {
  ensureRow(date)[field] = event.target.textContent ?? "";
}

/** 失焦时才规范化空白；此时元素已经失去焦点，回写不会影响输入位置。 */
function onCellBlur(event, date, field) {
  const normalized = String(event.target.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
  ensureRow(date)[field] = normalized;
  if (event.target.textContent !== normalized) event.target.textContent = normalized;
}

function cycleStatus(date, field) {
  const row = ensureRow(date);
  row[field] = nextStatus(row[field]);
}

/** 清空这一天：把记录整个删掉，那行回到空白天。 */
function clearDay(date) {
  rows.value = rows.value.filter((row) => row.date !== date);
}

function goToday() {
  activeMonth.value = todayMonth;
  nextTick(() => {
    document
      .getElementById(`plan-day-${today}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}
</script>

<template>
  <main class="container section plan-page">
    <header class="plan-hero">
      <div class="plan-hero-text">
        <h1 class="plan-hero-title">学习计划</h1>
        <p class="plan-hero-desc">
          按年月归档：选一个月份，表格就铺开这个月的每一天，填过的才有记录。
          点右侧圆点切换状态（完成 → 部分 → 未完成），单元格点进去就能改。
        </p>
      </div>
      <div class="plan-hero-actions">
        <button type="button" class="btn btn-ghost" @click="goToday">回到今天</button>
      </div>
    </header>

    <section class="plan-months" aria-label="选择年月">
      <button
        v-for="month in monthOptions"
        :key="month"
        type="button"
        class="plan-month-pill"
        :class="{ 'is-active': month === activeMonth }"
        :aria-pressed="month === activeMonth"
        @click="activeMonth = month"
      >
        {{ formatMonthLabel(month) }}
      </button>
    </section>

    <section class="plan-stats" :aria-label="`${formatMonthLabel(activeMonth)} 完成情况`">
      <article v-for="item in statCards" :key="item.label" class="plan-stat">
        <p class="plan-stat-label">{{ item.label }}</p>
        <p class="plan-stat-value">
          {{ item.value }}<span v-if="item.unit" class="plan-stat-unit">{{ item.unit }}</span>
        </p>
      </article>
      <article class="plan-stat">
        <p class="plan-stat-label">整体进度</p>
        <p class="plan-stat-value">{{ stats.percent }}%</p>
        <div
          class="plan-progress-bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="stats.percent"
          :aria-label="`本月整体进度 ${stats.percent}%`"
        >
          <span :style="{ width: `${stats.percent}%` }"></span>
        </div>
      </article>
    </section>

    <div class="plan-table-wrap">
      <table class="plan-table">
        <colgroup>
          <col class="plan-col-date" />
          <col />
          <col class="plan-col-status" />
          <col />
          <col class="plan-col-status" />
          <col />
          <col class="plan-col-status" />
          <col class="plan-col-op" />
        </colgroup>
        <thead>
          <tr>
            <th>日期</th>
            <th>事件一</th>
            <th class="plan-th-center">完成</th>
            <th>事件二</th>
            <th class="plan-th-center">完成</th>
            <th>事件三</th>
            <th class="plan-th-center">完成</th>
            <th><span class="sr-only">操作</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="date in monthDates"
            :id="`plan-day-${date}`"
            :key="date"
            :class="{ 'is-today': date === today }"
            :style="{ '--plan-stage': stageColorFor(date) }"
          >
            <td class="plan-date">{{ shortDate(date) }}</td>
            <template v-for="(eventField, slot) in EVENT_FIELDS" :key="eventField">
              <td>
                <div
                  class="plan-cell"
                  contenteditable="plaintext-only"
                  role="textbox"
                  :aria-label="`${shortDate(date)} 事件${slot + 1}`"
                  @input="onCellInput($event, date, eventField)"
                  @blur="onCellBlur($event, date, eventField)"
                  @keydown.enter.prevent="$event.target.blur()"
                >{{ cellText(date, eventField) }}</div>
              </td>
              <td class="plan-status">
                <button
                  type="button"
                  class="plan-status-btn"
                  :data-status="statusOf(date, STATUS_FIELDS[slot])"
                  :title="STATUS_LABEL[statusOf(date, STATUS_FIELDS[slot])]"
                  :aria-label="`${shortDate(date)} 事件${slot + 1}：${STATUS_LABEL[statusOf(date, STATUS_FIELDS[slot])]}`"
                  @click="cycleStatus(date, STATUS_FIELDS[slot])"
                >{{ STATUS_ICON[statusOf(date, STATUS_FIELDS[slot])] }}</button>
              </td>
            </template>
            <td class="plan-op">
              <button
                type="button"
                class="plan-del"
                :aria-label="`清空 ${shortDate(date)} 的记录`"
                title="清空这一天"
                @click="clearDay(date)"
              >
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>
