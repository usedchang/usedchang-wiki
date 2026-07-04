<script setup>
import { computed, ref, watch } from "vue";

const STORAGE_KEY = "usedchang-weekly-todos";

function getWeekInfo(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay() || 7;
  current.setDate(current.getDate() + 4 - day);
  const yearStart = new Date(current.getFullYear(), 0, 1);
  const week = Math.ceil((((current - yearStart) / 86400000) + 1) / 7);
  return {
    id: `${current.getFullYear()}-W${String(week).padStart(2, "0")}`,
    label: `${current.getFullYear()} 第 ${week} 周`,
  };
}

function defaultState() {
  const week = getWeekInfo();
  return {
    activeWeekId: week.id,
    weeks: [
      {
        id: week.id,
        label: week.label,
        todos: [],
      },
    ],
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.weeks?.length) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

const state = ref(loadState());
const todoForm = ref({ oj: "Codeforces", problemId: "", title: "", link: "" });

watch(
  state,
  (value) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)),
  { deep: true }
);

const weeks = computed(() => state.value.weeks);
const activeWeek = computed(
  () => weeks.value.find((w) => w.id === state.value.activeWeekId) || weeks.value[0]
);
const todos = computed(() => activeWeek.value?.todos || []);
const doneCount = computed(() => todos.value.filter((item) => item.done).length);
const progressPercent = computed(() => {
  const n = todos.value.length;
  if (!n) return 0;
  return Math.round((doneCount.value / n) * 100);
});

function switchWeek(id) {
  state.value.activeWeekId = id;
}

function addCurrentWeek() {
  const week = getWeekInfo();
  const exists = weeks.value.some((item) => item.id === week.id);
  if (!exists) {
    state.value.weeks.unshift({ id: week.id, label: week.label, todos: [] });
  }
  state.value.activeWeekId = week.id;
}

function addTodo() {
  if (!todoForm.value.title.trim()) return;
  activeWeek.value.todos.unshift({
    id: crypto.randomUUID(),
    oj: todoForm.value.oj,
    problemId: todoForm.value.problemId.trim(),
    title: todoForm.value.title.trim(),
    link: todoForm.value.link.trim(),
    done: false,
  });
  todoForm.value = { oj: "Codeforces", problemId: "", title: "", link: "" };
}

function toggleDone(id) {
  const target = activeWeek.value.todos.find((item) => item.id === id);
  if (target) target.done = !target.done;
}

function removeTodo(id) {
  activeWeek.value.todos = activeWeek.value.todos.filter((item) => item.id !== id);
}
</script>

<template>
  <main class="container section plan-page">
    <header class="plan-hero">
      <div class="plan-hero-text">
        <h2 class="plan-hero-title">学习计划</h2>
        <p class="plan-hero-desc">按周记录刷题，完成一项勾一项。</p>
      </div>
      <div
        class="plan-progress"
        role="img"
        :aria-label="`本周进度 ${doneCount} 题已完成，共 ${todos.length} 题`"
      >
        <div
          class="plan-progress-ring"
          :style="{ '--plan-p': String(progressPercent) }"
        />
        <div class="plan-progress-meta">
          <span class="plan-progress-value">{{ doneCount }}/{{ todos.length }}</span>
          <span class="plan-progress-label">本周完成</span>
        </div>
      </div>
    </header>

    <section class="panel plan-week-panel" aria-label="选择周次">
      <div class="plan-week-head">
        <h3 class="plan-week-heading">周次</h3>
        <button type="button" class="btn btn-primary plan-week-action" @click="addCurrentWeek">
          跳到本周
        </button>
      </div>
      <div class="plan-week-scroll">
        <button
          v-for="week in weeks"
          :key="week.id"
          type="button"
          class="plan-week-pill"
          :class="{ 'plan-week-pill-active': week.id === activeWeek.id }"
          @click="switchWeek(week.id)"
        >
          {{ week.label }}
        </button>
      </div>
    </section>

    <section class="panel plan-add-panel" aria-label="添加题目">
      <h3 class="panel-title plan-add-title">添加题目</h3>
      <div class="plan-form">
        <div class="plan-field">
          <label class="plan-label" for="plan-oj">OJ</label>
          <select id="plan-oj" v-model="todoForm.oj" class="plan-input">
            <option>Codeforces</option>
            <option>AtCoder</option>
            <option>Luogu</option>
            <option>Other</option>
          </select>
        </div>
        <div class="plan-field">
          <label class="plan-label" for="plan-pid">题号</label>
          <input
            id="plan-pid"
            v-model="todoForm.problemId"
            class="plan-input"
            placeholder="例如 1941A"
            autocomplete="off"
          />
        </div>
        <div class="plan-field plan-field-span">
          <label class="plan-label" for="plan-title">标题 <span class="plan-req">*</span></label>
          <input
            id="plan-title"
            v-model="todoForm.title"
            class="plan-input"
            placeholder="题目标题"
            autocomplete="off"
          />
        </div>
        <div class="plan-field plan-field-span">
          <label class="plan-label" for="plan-link">链接</label>
          <input
            id="plan-link"
            v-model="todoForm.link"
            class="plan-input"
            placeholder="可选，便于一键打开题目页"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="plan-form-footer">
        <button type="button" class="btn btn-primary" @click="addTodo">加入本周列表</button>
      </div>
    </section>

    <section class="plan-tasks-section" aria-label="本周任务列表">
      <h3 class="plan-tasks-heading">本周任务</h3>
      <div class="plan-list-wrap">
        <article
          v-for="item in todos"
          :key="item.id"
          class="plan-task-card"
          :data-done="item.done ? '1' : '0'"
        >
          <label class="plan-task-main">
            <input
              class="plan-task-check"
              type="checkbox"
              :checked="item.done"
              @change="toggleDone(item.id)"
            />
            <div class="plan-task-body">
              <span class="plan-task-badge">{{ item.oj }}</span>
              <p class="plan-task-title" :class="{ 'plan-task-title-done': item.done }">
                <span class="plan-task-id">{{ item.problemId || "—" }}</span>
                {{ item.title }}
              </p>
            </div>
          </label>
          <div class="plan-task-actions">
            <a
              v-if="item.link"
              class="btn btn-ghost plan-task-link"
              :href="item.link"
              target="_blank"
              rel="noreferrer"
            >
              打开
            </a>
            <button type="button" class="btn btn-danger plan-task-del" @click="removeTodo(item.id)">
              删除
            </button>
          </div>
        </article>
        <div v-if="!todos.length" class="empty-state plan-empty">
          本周还没有任务。先在上方填好题目，点「加入本周列表」即可开始打卡。
        </div>
      </div>
    </section>
  </main>
</template>
