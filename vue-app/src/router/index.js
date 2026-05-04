import { createRouter, createWebHistory } from "vue-router";
import { SITE_TITLE } from "../constants";
import NotFoundView from "../views/NotFoundView.vue";

const routes = [
  { path: "/", name: "home", component: () => import("../views/HomeView.vue"), meta: { title: "首页" } },
  {
    path: "/study-plan",
    name: "study-plan",
    component: () => import("../views/StudyPlanView.vue"),
    meta: { title: "学习计划" },
  },
  {
    path: "/cf-daily",
    name: "cf-daily",
    component: () => import("../views/CfDailyView.vue"),
    meta: { title: "CF 统计" },
  },
  {
    path: "/solutions",
    name: "solutions",
    component: () => import("../views/SolutionListView.vue"),
    meta: { title: "题解管理" },
  },
  {
    path: "/solutions/:id",
    name: "solution-editor",
    component: () => import("../views/SolutionEditorView.vue"),
    meta: { title: "编辑题解", articleKind: "solution" },
  },
  {
    path: "/journal",
    name: "journal",
    component: () => import("../views/JournalListView.vue"),
    meta: { title: "游记" },
  },
  {
    path: "/journal/:id",
    name: "journal-editor",
    component: () => import("../views/SolutionEditorView.vue"),
    meta: { title: "编辑游记", articleKind: "journal" },
  },
  {
    path: "/posts/:id",
    name: "solution-read",
    component: () => import("../views/SolutionReadView.vue"),
    meta: { title: "阅读" },
  },
  {
    path: "/friends",
    name: "friends",
    component: () => import("../views/FriendsView.vue"),
    meta: { title: "友链" },
  },
  { path: "/404", name: "not-found", component: NotFoundView, meta: { title: "页面不存在" } },
  { path: "/:pathMatch(.*)*", redirect: "/404" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, saved) {
    if (saved) return saved;
    return { top: 0, left: 0 };
  },
});

router.afterEach((to) => {
  const piece = to.meta?.title;
  document.title = piece ? `${piece} · ${SITE_TITLE}` : SITE_TITLE;
});

export default router;

