<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import {
  auth,
  listZones,
  listWorkers,
  listPagesProjects,
  listKvNamespaces,
  listR2Buckets,
  listD1Databases,
} from "../api/client";

const router = useRouter();

const zones = ref(0);
const workers = ref(0);
const pages = ref(0);
const kv = ref(0);
const r2 = ref(0);
const d1 = ref(0);
const loading = ref(true);
const error = ref("");

const userName = computed(() => auth.user?.email ?? auth.user?.username ?? "朋友");

const cards = computed(() => [
  { label: "域名 Zones", value: zones.value, icon: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z", to: "/dns", color: "#f69a22" },
  { label: "Workers", value: workers.value, icon: "M13 2L3 14h7l-1 8 10-12h-7l1-8z", to: "/workers", color: "#7aa2f7" },
  { label: "Pages 项目", value: pages.value, icon: "M3 5h18v14H3zM3 9h18", to: "/workers", color: "#9ece6a" },
  { label: "KV 命名空间", value: kv.value, icon: "M4 6h16v4H4zM4 12h16v4H4zM6 18h12", to: "/storage", color: "#bb9af7" },
  { label: "R2 存储桶", value: r2.value, icon: "M12 3l8 4v10l-8 4-8-4V7l8-4z", to: "/storage", color: "#73daca" },
  { label: "D1 数据库", value: d1.value, icon: "M4 4h16v6H4zM4 14h16v6H4z", to: "/storage", color: "#e0af68" },
]);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const results = await Promise.allSettled([
      listZones(),
      listWorkers(),
      listPagesProjects(),
      listKvNamespaces(),
      listR2Buckets(),
      listD1Databases(),
    ]);
    const [z, w, p, k, r, d] = results;
    zones.value = z.status === "fulfilled" ? z.value.length : 0;
    workers.value = w.status === "fulfilled" ? w.value.length : 0;
    pages.value = p.status === "fulfilled" ? p.value.length : 0;
    kv.value = k.status === "fulfilled" ? k.value.length : 0;
    r2.value = r.status === "fulfilled" ? r.value.length : 0;
    d1.value = d.status === "fulfilled" ? d.value.length : 0;
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      const first = failed[0] as PromiseRejectedResult;
      error.value = `部分模块加载失败：${(first.reason as Error).message}`;
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="home">
    <section class="hero">
      <h2>你好，{{ userName }}</h2>
      <p>这里是你的 Cloudflare 资源总览，点卡片快速进入管理。</p>
    </section>

    <p v-if="error" class="warn">{{ error }}</p>

    <div v-if="loading" class="skeleton">正在加载资源统计…</div>

    <div class="grid">
      <button
        v-for="c in cards"
        :key="c.label"
        class="card"
        @click="router.push(c.to)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" :style="{ color: c.color }">
          <path :d="c.icon" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div class="num">{{ loading ? "…" : c.value }}</div>
        <div class="label">{{ c.label }}</div>
      </button>
    </div>

    <section class="quick">
      <h3>快捷说明</h3>
      <ul>
        <li>DNS：增删改查记录、切换橙云代理（仅对支持代理的记录类型生效）</li>
        <li>Workers：查看/新建/删除脚本、查看代码、管理机密与绑定；Pages 项目部署、环境变量、绑定与设置</li>
        <li>存储：KV 命名空间增删与键值读写、R2 存储桶增删/文件浏览/上传下载/CORS/自定义域、D1 数据库增删与 SQL 查询</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.hero h2 {
  margin: 0 0 6px;
  font-size: 20px;
}
.hero p {
  margin: 0;
  color: #8b95a9;
  font-size: 13px;
}
.warn {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 122, 110, 0.12);
  color: #ff7a6e;
  font-size: 13px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 8px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: #e8edf5;
  cursor: pointer;
  text-align: center;
}
.card svg {
  width: 24px;
  height: 24px;
}
.num {
  font-size: 22px;
  font-weight: 700;
}
.label {
  font-size: 12px;
  color: #8b95a9;
}
.quick {
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.quick h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.quick ul {
  margin: 0;
  padding-left: 18px;
  color: #8b95a9;
  font-size: 12px;
  line-height: 1.8;
}
</style>