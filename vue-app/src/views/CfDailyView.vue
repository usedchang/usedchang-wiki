<script setup>
import { computed, onMounted, ref, nextTick } from "vue";
import { pushToast } from "../utils/toast";

const CF_HANDLE_KEY = "usedchang-cf-handle";
const CF_HANDLE_HISTORY_KEY = "usedchang-cf-handle-history";
const selectedDate = ref(new Date().toISOString().slice(0, 10));
const loading = ref(false);
const errorMessage = ref("");
const submissions = ref([]);
const handleInput = ref("usedchang");
const handleHistory = ref([]);

const ratingBuckets = [
  { key: "lt1200", label: "<1200", min: -Infinity, max: 1199 },
  { key: "1200-1599", label: "1200-1599", min: 1200, max: 1599 },
  { key: "1600-1999", label: "1600-1999", min: 1600, max: 1999 },
  { key: "ge2000", label: ">=2000", min: 2000, max: Infinity },
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

const displayHandle = computed(() => handleInput.value.trim() || "（未填写）");

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
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
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
  loading.value = true;
  errorMessage.value = "";
  try {
    const api = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(
      currentHandle
    )}&from=1&count=10000`;
    const response = await fetch(api);
    const data = await response.json();
    if (!response.ok || data.status !== "OK") {
      throw new Error(data.comment || "Codeforces API 请求失败");
    }
    submissions.value = data.result || [];
    localStorage.setItem(CF_HANDLE_KEY, currentHandle);
    updateHistory(currentHandle);
    pushToast(`已加载 ${currentHandle} 的统计数据`, "success");
  } catch (error) {
    errorMessage.value = error.message || "请求失败，请稍后重试。";
    pushToast(errorMessage.value, "error", 3200);
  } finally {
    loading.value = false;
  }
}

function updateHistory(handle) {
  const next = [handle, ...handleHistory.value.filter((item) => item !== handle)].slice(0, 6);
  handleHistory.value = next;
  localStorage.setItem(CF_HANDLE_HISTORY_KEY, JSON.stringify(next));
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
  if (verdict === "OK") return "AC";
  return verdict || "—";
}

function verdictTone(verdict) {
  if (verdict === "OK") return "cf-verdict-ac";
  return "cf-verdict-other";
}

function formatSubmitTime(sec) {
  return new Date(sec * 1000).toLocaleString("zh-CN", { hour12: false });
}

function selectHeatmapDay(key) {
  selectedDate.value = key;
  nextTick(() => {
    document.getElementById("cf-day-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

onMounted(() => {
  const saved = localStorage.getItem(CF_HANDLE_KEY);
  if (saved) handleInput.value = saved;
  try {
    const parsed = JSON.parse(localStorage.getItem(CF_HANDLE_HISTORY_KEY) || "[]");
    handleHistory.value = Array.isArray(parsed) ? parsed : [];
  } catch {
    handleHistory.value = [];
  }
  loadCfData();
});
</script>

<template>
  <main class="container section cf-page">
    <div class="section-title-row">
      <h2>Codeforces 每日学习统计</h2>
    </div>

    <div class="panel">
      <div class="form-grid">
        <input v-model="handleInput" placeholder="输入 handle，如 tourist" />
        <input v-model="selectedDate" type="date" />
      </div>
      <button class="btn btn-primary" :disabled="loading" @click="loadCfData">
        {{ loading ? "加载中..." : "刷新统计" }}
      </button>
      <div v-if="handleHistory.length" class="cf-history">
        <span class="cf-history-label">最近账号：</span>
        <button
          v-for="item in handleHistory"
          :key="item"
          class="btn btn-ghost cf-history-item"
          @click="useHistoryHandle(item)"
        >
          {{ item }}
        </button>
      </div>
      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
    </div>

    <div class="cf-metrics">
      <article class="panel metric-card">
        <p class="metric-label">当天做题数（去重 AC）</p>
        <p class="metric-value">{{ solvedCount }}</p>
      </article>
      <article class="panel metric-card">
        <p class="metric-label">当天 AC 率</p>
        <p class="metric-value">{{ acRate }}%</p>
      </article>
      <article class="panel metric-card">
        <p class="metric-label">连续打卡天数（到今天）</p>
        <p class="metric-value">{{ streakDays }}</p>
      </article>
      <article class="panel metric-card">
        <p class="metric-label">当天提交数</p>
        <p class="metric-value">{{ dailySubmissions.length }}</p>
      </article>
    </div>

    <div class="panel">
      <h3 class="panel-title">题目难度分布（当天去重 AC）</h3>
      <div class="distribution-list">
        <div v-for="bucket in ratingDistribution" :key="bucket.key" class="dist-row">
          <span>{{ bucket.label }}</span>
          <strong>{{ bucket.count }}</strong>
        </div>
      </div>
    </div>

    <div class="panel">
      <h3 class="panel-title">最近 30 天提交热力图</h3>
      <p class="cf-heatmap-hint">点击某一天，下方会列出该 handle 在当天的每一次提交（含未 AC）。</p>
      <div class="heatmap-grid">
        <button
          v-for="day in heatmapDays"
          :key="day.key"
          type="button"
          class="heat-cell"
          :class="[`heat-level-${day.level}`, { 'heat-cell-selected': day.key === selectedDate }]"
          :title="`${day.key}：${day.count} 次提交，点击查看当日明细`"
          @click="selectHeatmapDay(day.key)"
        >
          {{ day.short }}
        </button>
      </div>
    </div>

    <div id="cf-day-detail" class="panel">
      <h3 class="panel-title">{{ selectedDate }} · {{ displayHandle }} 当日提交</h3>
      <p v-if="!dailySubmissionsSorted.length" class="empty-hint">该日无提交记录（或尚未加载数据）。</p>
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
                    rel="noreferrer"
                  >
                    {{ row.problem.contestId }}{{ row.problem.index }} · {{ row.problem.name }}
                  </a>
                  <span v-else>{{ row.problem.name || "—" }}</span>
                </template>
                <span v-else>—</span>
              </td>
              <td>
                <span class="cf-verdict" :class="verdictTone(row.verdict)">{{
                  verdictLabel(row.verdict)
                }}</span>
              </td>
              <td class="cf-day-lang">{{ row.programmingLanguage || "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="panel">
      <h3 class="panel-title">近期刷题（最近通过）</h3>
      <div v-if="recentSolvedProblems.length" class="recent-list">
        <article
          v-for="problem in recentSolvedProblems"
          :key="problem.key"
          class="recent-item"
        >
          <div>
            <p class="recent-title">
              <a v-if="problem.url" :href="problem.url" target="_blank" rel="noreferrer">
                {{ problem.code }} - {{ problem.title }}
              </a>
              <span v-else>{{ problem.code }} - {{ problem.title }}</span>
            </p>
            <p class="recent-meta">rating: {{ problem.rating }} · {{ problem.timeText }}</p>
          </div>
          <a
            v-if="problem.url"
            class="btn btn-ghost"
            :href="problem.url"
            target="_blank"
            rel="noreferrer"
          >
            题目链接
          </a>
        </article>
      </div>
      <p v-else class="empty-hint">暂无通过记录，先去 A 一题吧。</p>
    </div>
  </main>
</template>
