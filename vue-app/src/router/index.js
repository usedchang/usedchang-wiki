import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import StudyPlanView from "../views/StudyPlanView.vue";
import CfDailyView from "../views/CfDailyView.vue";
import SolutionEditorView from "../views/SolutionEditorView.vue";
import SolutionListView from "../views/SolutionListView.vue";
import SolutionReadView from "../views/SolutionReadView.vue";
import NotFoundView from "../views/NotFoundView.vue";
import FriendsView from "../views/FriendsView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/study-plan", name: "study-plan", component: StudyPlanView },
    { path: "/cf-daily", name: "cf-daily", component: CfDailyView },
    { path: "/solutions", name: "solutions", component: SolutionListView },
    { path: "/solutions/:id", name: "solution-editor", component: SolutionEditorView },
    { path: "/posts/:id", name: "solution-read", component: SolutionReadView },
    { path: "/friends", name: "friends", component: FriendsView },
    { path: "/404", name: "not-found", component: NotFoundView },
    { path: "/:pathMatch(.*)*", redirect: "/404" },
  ],
});

export default router;