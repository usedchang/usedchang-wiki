import { createRouter, createWebHistory } from "vue-router";
import { SITE_TITLE } from "../constants";
import NotFoundView from "../views/NotFoundView.vue";
import { supabase, supabaseConfigured } from "../utils/supabase";
import { checkIsAdmin } from "../composables/usePermission";
import { getSafeNextPath } from "../utils/authNavigation";

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
    component: () => import("../views/SolutionArchiveView.vue"),
    meta: { title: "题解归档" },
  },
  {
    path: "/knowledge",
    name: "knowledge",
    component: () => import("../views/KnowledgeArchiveView.vue"),
    meta: { title: "知识学习" },
  },
  {
    path: "/knowledge/:id",
    redirect: (to) => ({ name: "solution-read", params: { id: to.params.id } }),
  },
  {
    path: "/solutions/:id",
    redirect: (to) => ({ name: "admin-solution-editor", params: { id: to.params.id } }),
  },
  {
    path: "/admin",
    redirect: { name: "admin-solutions" },
  },
  {
    path: "/admin/solutions",
    name: "admin-solutions",
    component: () => import("../views/SolutionListView.vue"),
    meta: { title: "题解管理", requiresAdmin: true },
  },
  {
    path: "/admin/solutions/:id",
    name: "admin-solution-editor",
    component: () => import("../views/SolutionEditorView.vue"),
    meta: { title: "编辑题解", articleKind: "solution", requiresAdmin: true },
  },
  {
    path: "/journal",
    redirect: { name: "admin-journal" },
  },
  {
    path: "/journal/:id",
    redirect: (to) => ({ name: "admin-journal-editor", params: { id: to.params.id } }),
  },
  {
    path: "/admin/journal",
    name: "admin-journal",
    component: () => import("../views/JournalListView.vue"),
    meta: { title: "游记管理", requiresAdmin: true },
  },
  {
    path: "/admin/journal/:id",
    name: "admin-journal-editor",
    component: () => import("../views/SolutionEditorView.vue"),
    meta: { title: "编辑游记", articleKind: "journal", requiresAdmin: true },
  },
  {
    path: "/admin/knowledge",
    name: "admin-knowledge",
    component: () => import("../views/KnowledgeListView.vue"),
    meta: { title: "知识学习管理", requiresAdmin: true },
  },
  {
    path: "/admin/knowledge/:id",
    name: "admin-knowledge-editor",
    component: () => import("../views/SolutionEditorView.vue"),
    meta: { title: "编辑知识学习", articleKind: "knowledge", requiresAdmin: true },
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
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { title: "登录" },
  },
  {
    path: "/auth/callback",
    name: "auth-callback",
    component: () => import("../views/AuthCallbackView.vue"),
    meta: { title: "账号验证" },
  },
  {
    path: "/reset-password",
    name: "reset-password",
    component: () => import("../views/ResetPasswordView.vue"),
    meta: { title: "重置密码" },
  },
  {
    path: "/403",
    name: "forbidden",
    component: () => import("../views/ForbiddenView.vue"),
    meta: { title: "没有权限" },
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
    // 本地降级只服务于开发写作；生产构建缺少后端配置时仍然拒绝管理访问。
    if (import.meta.env.DEV && !supabaseConfigured) return true;
    const { data: { session }, error } = await supabase.auth.getSession();
    const next = getSafeNextPath(to.fullPath);
    if (error || !session) return { name: "login", query: { next } };

    try {
      if (!(await checkIsAdmin())) return { name: "forbidden", query: { next } };
    } catch (permissionError) {
      console.warn(permissionError?.message || "管理员权限校验失败");
      return { name: "forbidden", query: { next } };
    }
  }
});

router.afterEach((to) => {
  const piece = to.meta?.title;
  document.title = piece ? `${piece} · ${SITE_TITLE}` : SITE_TITLE;
});

export default router;

