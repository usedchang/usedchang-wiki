<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { pushToast } from "../utils/toast";

const CF_HANDLE_KEY = "usedchang-cf-handle";
const CF_HANDLE_HISTORY_KEY = "usedchang-cf-handle-history";

function toLocalDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

const todayKey = toLocalDateKey(new Date());
const selectedDate = ref(todayKey);
const loading = ref(false);
const errorMessage = ref("");
const submissions = ref([]);
const handleInput = ref("usedchang");
const handleHistory = ref([]);
const loadedHandle = ref("");
const lastUpdatedAt = ref(null);
let requestController = null;
let requestId = 0;

const ratingBuckets = [
  { key: "lt1200", label: "<1200", min: -Infinity, max: 1199 },
  { key: "1200-1599", label: "1200–1599", min: 1200, max: 1599 },
  { key: "1600-1999", label: "1600–1999", min: 1600, max: 1999 },
  { key: "ge2000", label: "≥2000", min: 2000, max: Infinity },
  { key: "unknown", label: "未标注", min: null, max: null },
];

const dayRange = computed(() => {
  const start = new Date(`${selectedDate.value}T00:00:00`);
  const end = new Date(`${selectedDate.value}T23:59:59`);
  return {
    startSec: Math.floor(start.getTime() / 1000),
    endSec: Math.floor(end.getTime() / 1000),
  };
});

const dailySubmissions = computed(() =>
  submissions.value.filter(
    (item) =>
      item.creationTimeSeconds >= dayRange.value.startSec &&
      item.creationTimeSeconds <= dayRange.value.endSec
  )
);

/** 所选自然日内的提交，按时间新→旧 */
const dailySubmissionsSorted = computed(() =>
  [...dailySubmissions.value].sort((a, b) => b.creationTimeSeconds - a.creationTimeSeconds)
);

const displayHandle = computed(
  () => loadedHandle.value || handleInput.value.trim() || "未填写"
);

const acceptedDailySubmissions = computed(() =>
  dailySubmissions.value.filter((item) => item.verdict === "OK")
);

const solvedSet = computed(() => {
  const set = new Map();
  for (const item of acceptedDailySubmissions.value) {
    const problem = item.problem || {};
    const key = `${problem.contestId || "gym"}-${problem.index || ""}-${problem.name || ""}`;
    if (!set.has(key)) set.set(key, problem);
  }
  return set;
});

const solvedCount = computed(() => solvedSet.value.size);

const acRate = computed(() => {
  const total = dailySubmissions.value.length;
  if (!total) return "0.00";
  return ((acceptedDailySubmissions.value.length / total) * 100).toFixed(2);
});

const metricCards = computed(() => [
  {
    key: "solved",
    label: "当天去重 AC",
    value: solvedCount.value,
    suffix: "题",
    note: `${acceptedDailySubmissions.value.length} 次通过提交`,
  },
  {
    key: "rate",
    label: "当天 AC 率",
    value: acRate.value,
    suffix: "%",
    note: dailySubmissions.value.length ? "按全部提交计算" : "当天暂无提交",
  },
  {
    key: "streak",
    label: "连续打卡",
    value: streakDays.value,
    suffix: "天",
    note: "连续统计至今天",
  },
  {
    key: "submissions",
    label: "当天提交",
    value: dailySubmissions.value.length,
    suffix: "次",
    note: "包含未通过记录",
  },
]);

const ratingDistribution = computed(() => {
  const result = ratingBuckets.map((item) => ({ ...item, count: 0 }));
  for (const problem of solvedSet.value.values()) {
    const rating = problem.rating;
    if (typeof rating !== "number") {
      result.find((bucket) => bucket.key === "unknown").count += 1;
      continue;
    }
    const matched = result.find(
      (bucket) =>
        bucket.min !== null && rating >= bucket.min && rating <= bucket.max
    );
    if (matched) matched.count += 1;
  }
  return result;
});

const streakDays = computed(() => {
  const acDates = new Set();
  for (const item of submissions.value) {
    if (item.verdict !== "OK") continue;
    const date = new Date(item.creationTimeSeconds * 1000);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
    acDates.add(key);
  }

  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!acDates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
});

const heatmapDays = computed(() => {
  const today = new Date();
  const dateKeys = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toLocalDateKey(d);
    dateKeys.push(key);
  }

  const countMap = new Map(dateKeys.map((key) => [key, 0]));
  for (const item of submissions.value) {
    const date = new Date(item.creationTimeSeconds * 1000);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
    if (countMap.has(key)) countMap.set(key, (countMap.get(key) || 0) + 1);
  }

  const maxCount = Math.max(...countMap.values(), 1);
  return dateKeys.map((key) => {
    const count = countMap.get(key) || 0;
    const level = Math.ceil((count / maxCount) * 4);
    return {
      key,
      count,
      level: count === 0 ? 0 : level,
      short: key.slice(5),
    };
  });
});

const selectedDateText = computed(() => {
  const date = new Date(`${selectedDate.value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return selectedDate.value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
});

const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) return "尚未同步";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(lastUpdatedAt.value);
});

function ratingBarWidth(count) {
  const maxCount = Math.max(...ratingDistribution.value.map((bucket) => bucket.count), 1);
  return count > 0 ? `${Math.max(7, (count / maxCount) * 100)}%` : "0%";
}

const recentSolvedProblems = computed(() => {
  const unique = new Map();
  for (const item of submissions.value) {
    if (item.verdict !== "OK") continue;
    const problem = item.problem || {};
    const key = `${problem.contestId || "gym"}-${problem.index || ""}-${problem.name || ""}`;
    if (unique.has(key)) continue;

    const submitTime = new Date(item.creationTimeSeconds * 1000);
    const hasContest = typeof problem.contestId === "number" && !!problem.index;
    const url = hasContest
      ? `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`
      : "";

    unique.set(key, {
      key,
      title: problem.name || "未命名题目",
      code: hasContest ? `${problem.contestId}${problem.index}` : "Gym/Other",
      rating: typeof problem.rating === "number" ? problem.rating : "未标注",
      url,
      timeText: submitTime.toLocaleString("zh-CN", { hour12: false }),
    });
    if (unique.size >= 12) break;
  }
  return [...unique.values()];
});

async function loadCfData() {
  const currentHandle = handleInput.value.trim();
  if (!currentHandle) {
    errorMessage.value = "请先输入 Codeforces handle。";
    return;
  }
  const currentRequest = ++requestId;
  requestController?.abort();
  requestController = new AbortController();
  loading.value = true;
  errorMessage.value = "";
  try {
    const api = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(
      currentHandle
    )}&from=1&count=10000`;
    const response = await fetch(api, { signal: requestController.signal });
    const data = await response.json();
    if (!response.ok || data.status !== "OK") {
      throw new Error(data.comment || "Codeforces API 请求失败");
    }
    if (currentRequest !== requestId) return;
    submissions.value = Array.isArray(data.result) ? data.result : [];
    loadedHandle.value = currentHandle;
    lastUpdatedAt.value = new Date();
    try {
      localStorage.setItem(CF_HANDLE_KEY, currentHandle);
    } catch {
      // 隐私模式禁用本地存储时，统计功能仍然可用。
    }
    updateHistory(currentHandle);
    pushToast(`已加载 ${currentHandle} 的统计数据`, "success");
  } catch (error) {
    if (error?.name === "AbortError" || currentRequest !== requestId) return;
    errorMessage.value = error.message || "请求失败，请稍后重试。";
    pushToast(errorMessage.value, "error", 3200);
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

function updateHistory(handle) {
  const next = [
    handle,
    ...handleHistory.value.filter((item) => item.toLocaleLowerCase() !== handle.toLocaleLowerCase()),
  ].slice(0, 6);
  handleHistory.value = next;
  try {
    localStorage.setItem(CF_HANDLE_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // 不让存储失败覆盖已成功加载的数据。
  }
}

function useHistoryHandle(handle) {
  handleInput.value = handle;
  loadCfData();
}

function problemUrl(problem) {
  if (!problem) return "";
  const cid = problem.contestId;
  const idx = problem.index;
  if (typeof cid === "number" && idx) {
    return `https://codeforces.com/problemset/problem/${cid}/${idx}`;
  }
  return "";
}

function verdictLabel(verdict) {
  const labels = {
    OK: "AC",
    WRONG_ANSWER: "WA",
    TIME_LIMIT_EXCEEDED: "TLE",
    MEMORY_LIMIT_EXCEEDED: "MLE",
    RUNTIME_ERROR: "RE",
    COMPILATION_ERROR: "CE",
    IDLENESS_LIMIT_EXCEEDED: "ILE",
    SECURITY_VIOLATED: "SV",
    SKIPPED: "SKIP",
    TESTING: "TESTING",
  };
  return labels[verdict] || verdict || "—";
}

function verdictTone(verdict) {
  if (verdict === "OK") return "cf-verdict-ac";
  if (verdict === "TESTING") return "cf-verdict-pending";
  return "cf-verdict-other";
}

function formatSubmitTime(sec) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(sec * 1000));
}

function selectHeatmapDay(key) {
  selectedDate.value = key;
  nextTick(() => {
    document.getElementById("cf-day-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

onMounted(() => {
  try {
    const saved = localStorage.getItem(CF_HANDLE_KEY);
    if (saved) handleInput.value = saved;
    const parsed = JSON.parse(localStorage.getItem(CF_HANDLE_HISTORY_KEY) || "[]");
    handleHistory.value = Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, 6)
      : [];
  } catch {
    handleHistory.value = [];
  }
  loadCfData();
});

onBeforeUnmount(() => {
  requestId += 1;
  requestController?.abort();
});
</script>

<template>
  <main class="container section cf-page">
    <header class="cf-page-header">
      <div>
        <p class="cf-eyebrow">CODEFORCES · TRAINING LOG</p>
        <h1>每日学习统计</h1>
        <p class="cf-page-subtitle">
          追踪 <strong>{{ displayHandle }}</strong> 的提交节奏，把每天的训练变成可回看的记录。
        </p>
      </div>
      <div class="cf-sync-status" :class="{ 'cf-sync-active': loadedHandle }">
        <span class="cf-sync-dot" aria-hidden="true"></span>
        <span>{{ loadedHandle ? `已同步 ${lastUpdatedText}` : "等待同步" }}</span>
      </div>
    </header>

    <section class="panel cf-query-panel" aria-label="统计查询条件">
      <div class="cf-query-main">
        <label class="cf-query-field">
          <span>Codeforces handle</span>
          <input
            v-model="handleInput"
            autocomplete="off"
            spellcheck="false"
            placeholder="如 tourist"
            @keyup.enter="loadCfData"
          />
        </label>
        <label class="cf-query-field cf-date-field">
          <span>查看日期</span>
          <input v-model="selectedDate" type="date" />
        </label>
        <button class="btn btn-primary cf-refresh-btn" :disabled="loading" @click="loadCfData">
          <span class="cf-refresh-icon" :class="{ 'cf-refresh-spinning': loading }" aria-hidden="true">↻</span>
          {{ loading ? "同步中" : "刷新统计" }}
        </button>
      </div>
      <div v-if="handleHistory.length" class="cf-history">
        <span class="cf-history-label">最近查询</span>
        <button
          v-for="item in handleHistory"
          :key="item"
          type="button"
          class="cf-history-item"
          :class="{ 'cf-history-item-active': item.toLocaleLowerCase() === displayHandle.toLocaleLowerCase() }"
          @click="useHistoryHandle(item)"
        >
          <span class="cf-history-avatar" aria-hidden="true">{{ item.slice(0, 1).toUpperCase() }}</span>
          {{ item }}
        </button>
      </div>
      <p v-if="errorMessage" class="error-text cf-error" role="alert">{{ errorMessage }}</p>
    </section>

    <section class="cf-metrics" aria-label="统计概览">
      <article v-for="metric in metricCards" :key="metric.key" class="panel metric-card">
        <div class="metric-card-heading">
          <span class="metric-icon" :class="`metric-icon-${metric.key}`" aria-hidden="true">
            {{ metric.key === "solved" ? "✓" : metric.key === "rate" ? "%" : metric.key === "streak" ? "↗" : "⌁" }}
          </span>
          <p class="metric-label">{{ metric.label }}</p>
        </div>
        <p class="metric-value">{{ metric.value }}<small>{{ metric.suffix }}</small></p>
        <p class="metric-note">{{ metric.note }}</p>
      </article>
    </section>

    <div class="cf-dashboard-grid">
      <section class="panel cf-distribution-panel">
        <div class="cf-panel-heading">
          <div>
            <p class="cf-panel-kicker">DIFFICULTY</p>
            <h2 class="panel-title">题目难度分布</h2>
          </div>
          <span class="cf-panel-total">{{ solvedCount }} 题</span>
        </div>
        <div class="distribution-list">
          <div v-for="bucket in ratingDistribution" :key="bucket.key" class="dist-row">
            <div class="dist-label"><span class="dist-dot" :class="`dist-dot-${bucket.key}`"></span>{{ bucket.label }}</div>
            <div class="dist-track" aria-hidden="true"><span :style="{ width: ratingBarWidth(bucket.count) }"></span></div>
            <strong>{{ bucket.count }}</strong>
          </div>
        </div>
        <p class="cf-panel-footnote">按当天去重后的 AC 题目统计</p>
      </section>

      <section class="panel cf-heatmap-panel">
        <div class="cf-panel-heading">
          <div>
            <p class="cf-panel-kicker">ACTIVITY</p>
            <h2 class="panel-title">最近 30 天</h2>
          </div>
          <span class="cf-panel-total">{{ submissions.length }} 次提交</span>
        </div>
        <p class="cf-heatmap-hint">选择一天查看提交明细</p>
        <div class="heatmap-grid">
          <button
            v-for="day in heatmapDays"
            :key="day.key"
            type="button"
            class="heat-cell"
            :class="[`heat-level-${day.level}`, { 'heat-cell-selected': day.key === selectedDate }]"
            :title="`${day.key}：${day.count} 次提交，点击查看当日明细`"
            :aria-label="`${day.key}，${day.count} 次提交`"
            @click="selectHeatmapDay(day.key)"
          >
            <span>{{ day.short }}</span>
            <small>{{ day.count || "·" }}</small>
          </button>
        </div>
        <div class="heatmap-legend" aria-label="提交次数图例">
          <span>少</span><i class="heat-level-0"></i><i class="heat-level-1"></i><i class="heat-level-2"></i><i class="heat-level-3"></i><i class="heat-level-4"></i><span>多</span>
        </div>
      </section>
    </div>

    <section id="cf-day-detail" class="panel cf-detail-panel">
      <div class="cf-panel-heading cf-detail-heading">
        <div>
          <p class="cf-panel-kicker">SUBMISSIONS</p>
          <h2 class="panel-title">{{ selectedDateText }}</h2>
          <p class="cf-detail-subtitle">{{ displayHandle }} · {{ dailySubmissions.length }} 次提交</p>
        </div>
        <span class="cf-detail-date">{{ selectedDate }}</span>
      </div>
      <p v-if="!dailySubmissionsSorted.length" class="empty-hint cf-empty-hint">这一天还没有提交记录。</p>
      <div v-else class="cf-day-table-wrap">
        <table class="cf-day-table">
          <thead>
            <tr>
              <th scope="col">时间</th>
              <th scope="col">题目</th>
              <th scope="col">结果</th>
              <th scope="col">语言</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in dailySubmissionsSorted" :key="row.id ?? idx">
              <td class="cf-day-time">{{ formatSubmitTime(row.creationTimeSeconds) }}</td>
              <td>
                <template v-if="row.problem">
                  <a
                    v-if="problemUrl(row.problem)"
                    class="cf-day-prob-link"
                    :href="problemUrl(row.problem)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="cf-problem-code">{{ row.problem.contestId }}{{ row.problem.index }}</span>
                    {{ row.problem.name }}
                  </a>
                  <span v-else>{{ row.problem.name || "—" }}</span>
                </template>
                <span v-else>—</span>
              </td>
              <td><span class="cf-verdict" :class="verdictTone(row.verdict)">{{ verdictLabel(row.verdict) }}</span></td>
              <td class="cf-day-lang">{{ row.programmingLanguage || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel cf-recent-panel">
      <div class="cf-panel-heading">
        <div>
          <p class="cf-panel-kicker">RECENT AC</p>
          <h2 class="panel-title">近期通过</h2>
        </div>
        <span class="cf-panel-total">最多展示 12 题</span>
      </div>
      <div v-if="recentSolvedProblems.length" class="recent-list">
        <article v-for="problem in recentSolvedProblems" :key="problem.key" class="recent-item">
          <div class="recent-item-main">
            <span class="recent-item-code">{{ problem.code }}</span>
            <div>
              <p class="recent-title">
                <a v-if="problem.url" :href="problem.url" target="_blank" rel="noopener noreferrer">{{ problem.title }}</a>
                <span v-else>{{ problem.title }}</span>
              </p>
              <p class="recent-meta"><span v-if="problem.rating !== '未标注'">{{ problem.rating }} rating</span><span>{{ problem.timeText }}</span></p>
            </div>
          </div>
          <a v-if="problem.url" class="recent-link" :href="problem.url" target="_blank" rel="noopener noreferrer" aria-label="打开题目">↗</a>
        </article>
      </div>
      <p v-else class="empty-hint cf-empty-hint">暂无通过记录，先去 A 一题吧。</p>
    </section>
  </main>
</template>
