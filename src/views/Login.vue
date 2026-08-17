<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../api/client";

const router = useRouter();
const pass = ref("");
const error = ref("");
const loading = ref(false);

async function onSubmit() {
  if (!pass.value.trim()) {
    error.value = "请输入访问口令";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    await login(pass.value.trim());
    router.replace("/");
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="login-card">
      <div class="logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M12 2c3.5 0 6 2.5 6 6 0 1.5-.6 2.9-1.5 3.9C18 13.3 19 15 19 17c0 2.8-3 5-7 5s-7-2.2-7-5c0-2 1-3.7 2.5-5.1C6.6 10.9 6 9.5 6 8c0-3.5 2.5-6 6-6z" />
          <path d="M9 18c2 1.5 4 1.5 6 0" />
        </svg>
      </div>
      <h1>CF Panel</h1>
      <p class="sub">Cloudflare 手机管理面板</p>

      <form @submit.prevent="onSubmit">
        <input
          v-model="pass"
          type="password"
          placeholder="访问口令"
          autocomplete="current-password"
        />
        <p v-if="error" class="err">{{ error }}</p>
        <button type="submit" :disabled="loading">
          {{ loading ? "验证中…" : "进入面板" }}
        </button>
      </form>

      <p class="tip">口令在部署时通过环境变量 PANEL_PASSWORD 设置，仅自己使用。</p>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: radial-gradient(1200px 600px at 80% -10%, rgba(249, 162, 34, 0.12), transparent),
    linear-gradient(180deg, #0b1220 0%, #0e1526 100%);
  color: #e8edf5;
}
.login-card {
  width: 100%;
  max-width: 360px;
  padding: 36px 28px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
}
.logo {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f9a222;
  background: rgba(249, 162, 34, 0.12);
}
h1 {
  margin: 0;
  font-size: 24px;
}
.sub {
  margin: 4px 0 24px;
  color: #8b95a9;
  font-size: 13px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
input {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 15px;
  outline: none;
}
input:focus {
  border-color: #f69a2222;
  box-shadow: 0 0 0 3px rgba(249, 162, 34, 0.15);
}
button {
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: #f69a22;
  color: #0b1220;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
}
.err {
  margin: 0;
  color: #ff7a6e;
  font-size: 13px;
  text-align: left;
}
.tip {
  margin: 16px 0 0;
  color: #6b768a;
  font-size: 12px;
  line-height: 1.6;
}
</style>