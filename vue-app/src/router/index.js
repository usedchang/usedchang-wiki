import { createRouter, createWebHistory } from "vue-router";
import { SITE_TITLE } from "../constants";
import NotFoundView from "../views/NotFoundView.vue";
import { supabase } from "../utils/supabase";

const routes = [
  { path: "/", name: "home", component: () => import("../views/HomeView.vue"), meta: { title: "首页" } },
  {
    path: "/study-plan",
    name: "study-plan",
    component: () => import("../views/StudyPlanView.vue"),
    meta: { title: "学习计划" },
  },
  {
    path: "/dp-optimization",
    name: "dp-optimization",
    component: () => import("../views/DpOptimizationView.vue"),
    meta: { title: "DP 优化" },
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
    meta: { title: "题解管理", requiresAdmin: true },
  },
  {
    path: "/solutions/:id",
    name: "solution-editor",
    component: () => import("../views/SolutionEditorView.vue"),
    meta: { title: "编辑题解", articleKind: "solution", requiresAdmin: true },
  },
  {
    path: "/journal",
    name: "journal",
    component: () => import("../views/JournalListView.vue"),
    meta: { title: "游记", requiresAdmin: true },
  },
  {
    path: "/journal/:id",
    name: "journal-editor",
    component: () => import("../views/SolutionEditorView.vue"),
    meta: { title: "编辑游记", articleKind: "journal", requiresAdmin: true },
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
  scrollBehavior(to, _from, saved) {
    if (saved) return saved;
    if (to.hash) return { el: to.hash, behavior: "smooth" };
    return { top: 0, left: 0 };
  },
});

// ── 权限守卫：非 admin 用户无法访问管理页面 ──
router.beforeEach(async (to) => {
  if (to.meta.requiresAdmin) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return "/";

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "admin") return "/";
  }
});

router.afterEach((to) => {
  const piece = to.meta?.title;
  document.title = piece ? `${piece} · ${SITE_TITLE}` : SITE_TITLE;
});

export default router;

