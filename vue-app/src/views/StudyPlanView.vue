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
    <div class="section-title-row">
      <h2>学习计划 To-Do（按周）</h2>
      <span class="plan-count">本周完成：{{ doneCount }}/{{ todos.length }}</span>
    </div>

    <div class="panel week-tabs">
      <div class="week-tab-list">
        <button
          v-for="week in weeks"
          :key="week.id"
          class="btn week-tab"
          :class="{ 'week-tab-active': week.id === activeWeek.id }"
          @click="switchWeek(week.id)"
        >
          {{ week.label }}
        </button>
      </div>
      <button class="btn btn-primary" @click="addCurrentWeek">切换/创建本周</button>
    </div>

    <div class="panel">
      <h3 class="panel-title">新增题单任务</h3>
      <div class="form-grid">
        <select v-model="todoForm.oj">
          <option>Codeforces</option>
          <option>AtCoder</option>
          <option>Luogu</option>
          <option>Other</option>
        </select>
        <input v-model="todoForm.problemId" placeholder="题号，如 1941A" />
        <input v-model="todoForm.title" placeholder="题目标题（必填）" />
      </div>
      <input v-model="todoForm.link" placeholder="题目链接（可选）" />
      <div class="card-actions">
        <button class="btn btn-primary" @click="addTodo">添加到本周 To-Do</button>
      </div>
    </div>

    <div class="plan-list-wrap">
      <article v-for="item in todos" :key="item.id" class="plan-card todo-item">
        <label class="todo-main">
          <input type="checkbox" :checked="item.done" @change="toggleDone(item.id)" />
          <div>
            <p class="todo-title" :class="{ 'todo-done': item.done }">
              [{{ item.oj }}] {{ item.problemId || "未填题号" }} - {{ item.title }}
            </p>
          </div>
        </label>
        <div class="todo-right">
          <a
            v-if="item.link"
            class="btn btn-ghost"
            :href="item.link"
            target="_blank"
            rel="noreferrer"
          >
            题目链接
          </a>
          <button class="btn btn-danger" @click="removeTodo(item.id)">删除</button>
        </div>
      </article>
      <div v-if="!todos.length" class="empty-state">
        当前周还没有任务，先加几道题，做完就勾选打卡。
      </div>
    </div>
  </main>
</template>
