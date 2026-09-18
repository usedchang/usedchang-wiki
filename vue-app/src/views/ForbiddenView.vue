<script setup>
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";
import { getSafeNextPath } from "../utils/authNavigation";

const route = useRoute();
const router = useRouter();
const { signOut } = useAuth();
const busy = ref(false);
const errorMessage = ref("");
const nextPath = computed(() => getSafeNextPath(route.query.next));

async function switchAccount() {
  if (busy.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await signOut();
    await router.replace({
      name: "login",
      query: nextPath.value === "/" ? {} : { next: nextPath.value },
    });
  } catch {
    errorMessage.value = "退出失败，请刷新页面后重试。";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="container section">
    <section class="panel forbidden-panel">
      <p class="app-error-code">403</p>
      <h1>当前账号没有访问权限</h1>
      <p>你已经登录，但该页面只允许管理员访问。页面入口隐藏不是安全边界，数据库也会拒绝普通账号的管理操作。</p>
      <p v-if="errorMessage" class="auth-error" role="alert">{{ errorMessage }}</p>
      <div class="card-actions">
        <RouterLink class="btn btn-ghost" to="/">返回首页</RouterLink>
        <button class="btn btn-primary" type="button" :disabled="busy" @click="switchAccount">
          {{ busy ? "退出中..." : "更换账号" }}
        </button>
      </div>
    </section>
  </main>
</template>
