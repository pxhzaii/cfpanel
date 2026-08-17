<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { auth, logout, listAccounts, listZones } from "../api/client";
import type { CfAccount, CfZone } from "../api/types";

const router = useRouter();
const accounts = ref<CfAccount[]>([]);
const zones = ref<CfZone[]>([]);
const loading = ref(false);
const error = ref("");

const user = computed(() => auth.user);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const results = await Promise.allSettled([listAccounts(), listZones()]);
    if (results[0].status === "fulfilled") accounts.value = results[0].value;
    if (results[1].status === "fulfilled") zones.value = results[1].value;
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    if (failed.length > 0) error.value = `部分信息加载失败：${(failed[0].reason as Error).message}`;
  } finally {
    loading.value = false;
  }
}

function onLogout() {
  logout();
  router.replace("/login");
}

onMounted(load);
</script>

<template>
  <div class="settings">
    <h2>设置</h2>

    <p v-if="error" class="err">{{ error }}</p>

    <section class="card">
      <h3>账号</h3>
      <div class="row">
        <span class="k">名称</span>
        <span class="v">{{ user?.name ?? "-" }}</span>
      </div>
      <div class="row">
        <span class="k">类型</span>
        <span class="v">{{ user?.type ?? "-" }}</span>
      </div>
      <div class="row">
        <span class="k">账号 ID</span>
        <span class="v mono">{{ user?.id ?? "-" }}</span>
      </div>
    </section>

    <section class="card">
      <h3>账号（Accounts）</h3>
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="accounts.length === 0" class="empty">暂无账号信息</div>
      <div v-else>
        <div v-for="a in accounts" :key="a.id" class="row">
          <span class="k">{{ a.name }}</span>
          <span class="v mono">{{ a.id }}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>域名（{{ zones.length }}）</h3>
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="zones.length === 0" class="empty">暂无域名</div>
      <div v-else>
        <div v-for="z in zones" :key="z.id" class="row">
          <span class="k">{{ z.name }}</span>
          <span :class="['v', z.status === 'active' ? 'ok' : '']">{{ z.status }}</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>关于</h3>
      <p class="about">
        CF Panel 是部署在 Cloudflare Pages 的移动端管理面板。访问口令与 API Token 均保存在服务端环境变量，
        API Token 不会下发到浏览器。
      </p>
      <button class="logout" @click="onLogout">退出登录</button>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h2 {
  margin: 0;
  font-size: 18px;
}
.card {
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.card h3 {
  margin: 0 0 10px;
  font-size: 14px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}
.row:last-child {
  border-bottom: none;
}
.k {
  color: #8b95a9;
}
.v {
  color: #e8edf5;
  word-break: break-all;
  text-align: right;
}
.mono {
  font-family: monospace;
  font-size: 11px;
}
.ok {
  color: #9ece6a;
}
.empty {
  color: #6b768a;
  font-size: 13px;
  text-align: center;
  padding: 12px 0;
}
.about {
  color: #8b95a9;
  font-size: 12px;
  line-height: 1.7;
}
.logout {
  width: 100%;
  margin-top: 12px;
  padding: 10px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 93, 77, 0.15);
  color: #ff7a6e;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
.err {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 122, 110, 0.12);
  color: #ff7a6e;
  font-size: 13px;
}
</style>