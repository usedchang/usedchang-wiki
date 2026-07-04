<script setup>
import { ref, computed } from "vue";
import { useAuth } from "../composables/useAuth";

const emit = defineEmits(["close", "login"]);

const { sendOtp } = useAuth();

const step = ref(0); // 0 = 输入邮箱, 1 = 已发送
const email = ref("");
const errorMsg = ref("");
const sending = ref(false);

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value));

async function handleSend() {
  if (!emailValid.value || sending.value) return;
  sending.value = true;
  errorMsg.value = "";
  try {
    await sendOtp(email.value.trim());
    step.value = 1;
  } catch (e) {
    errorMsg.value = e.message || "发送失败，请稍后重试";
  } finally {
    sending.value = false;
  }
}

function goBack() {
  step.value = 0;
  errorMsg.value = "";
}

function close() {
  emit("close");
}
</script>

<template>
  <div class="auth-overlay" @click.self="close">
    <div class="auth-modal">
      <button class="auth-close" @click="close" aria-label="关闭">&times;</button>

      <h2 class="auth-title">登录 / 注册</h2>
      <p class="auth-sub">无需密码，点击邮件中的链接即可登录</p>

      <!-- 步骤 0：输入邮箱 -->
      <div v-if="step === 0" class="auth-body">
        <label class="auth-label" for="auth-email">邮箱地址</label>
        <input
          id="auth-email"
          v-model="email"
          type="email"
          class="form-input"
          placeholder="your@email.com"
          :disabled="sending"
          @keyup.enter="handleSend"
        />
        <p v-if="errorMsg" class="auth-error">{{ errorMsg }}</p>
        <button
          class="btn btn-primary auth-btn"
          :disabled="!emailValid || sending"
          @click="handleSend"
        >
          {{ sending ? "发送中..." : "发送登录链接" }}
        </button>
      </div>

      <!-- 步骤 1：已发送 -->
      <div v-else class="auth-body auth-success">
        <div class="auth-success-icon">📧</div>
        <p class="auth-hint">
          登录链接已发送至 <strong>{{ email }}</strong>
        </p>
        <p class="auth-hint-sub">
          请打开邮箱，点击邮件中的链接即可完成登录。<br />
          如未收到，请检查垃圾邮件箱。
        </p>
        <button class="btn btn-ghost auth-btn" @click="goBack">使用其他邮箱</button>
      </div>
    </div>
  </div>
</template>
