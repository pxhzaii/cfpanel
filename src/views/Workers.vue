<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { listWorkers, getWorkerScript, listPagesProjects, listPagesDeployments } from "../api/client";
import type { CfWorkerScript, CfPagesProject, CfPagesDeployment } from "../api/types";

const tab = ref<"workers" | "pages">("workers");
const workers = ref<CfWorkerScript[]>([]);
const pages = ref<CfPagesProject[]>([]);
const loading = ref(false);
const error = ref("");
const workerDetail = ref<string | null>(null);
const workerCode = ref("");
const pagesDeployments = ref<CfPagesDeployment[]>([]);
const activeProject = ref<CfPagesProject | null>(null);

const counts = computed(() => ({
  workers: workers.value.length,
  pages: pages.value.length,
}));

async function loadWorkers() {
  loading.value = true;
  error.value = "";
  try {
    workers.value = await listWorkers();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadPages() {
  loading.value = true;
  error.value = "";
  try {
    pages.value = await listPagesProjects();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function openWorker(name: string) {
  workerCode.value = "";
  workerDetail.value = name;
  try {
    workerCode.value = await getWorkerScript(name);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function openDeployments(p: CfPagesProject) {
  activeProject.value = p;
  pagesDeployments.value = [];
  try {
    pagesDeployments.value = await listPagesDeployments(p.name);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function formatDate(s: string) {
  if (!s) return "-";
  const d = new Date(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(() => {
  loadWorkers();
  loadPages();
});
</script>

<template>
  <div class="wp">
    <div class="head">
      <h2>Workers / Pages</h2>
      <div class="tabs">
        <button :class="{ active: tab === 'workers' }" @click="tab = 'workers'">
          Workers（{{ counts.workers }}）
        </button>
        <button :class="{ active: tab === 'pages' }" @click="tab = 'pages'">
          Pages（{{ counts.pages }}）
        </button>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <!-- Workers 列表 -->
    <div v-if="tab === 'workers'">
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="workers.length === 0" class="empty">暂无 Workers 脚本</div>
      <div class="list">
        <div v-for="w in workers" :key="w.id" class="item" @click="openWorker(w.id)">
          <div class="item-main">
            <div class="item-title">{{ w.id }}</div>
            <div class="item-sub">更新于 {{ formatDate(w.modified_on) }}</div>
          </div>
          <div class="item-arrow">›</div>
        </div>
      </div>
    </div>

    <!-- Pages 列表 -->
    <div v-else>
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="pages.length === 0" class="empty">暂无 Pages 项目</div>
      <div class="list">
        <div v-for="p in pages" :key="p.id" class="item" @click="openDeployments(p)">
          <div class="item-main">
            <div class="item-title">{{ p.name }}</div>
            <div class="item-sub">{{ p.subdomain }}</div>
            <div class="item-sub" v-if="p.domains?.length">绑定域名：{{ p.domains.join("、") }}</div>
          </div>
          <div class="item-arrow">›</div>
        </div>
      </div>
    </div>

    <!-- Worker 代码弹层 -->
    <div v-if="workerDetail" class="mask">
      <div class="sheet">
        <div class="sheet-head">
          <h3>{{ workerDetail }}</h3>
          <button class="close" @click="workerDetail = null">关闭</button>
        </div>
        <pre class="code">{{ workerCode || "加载中…" }}</pre>
      </div>
    </div>

    <!-- Pages 部署弹层 -->
    <div v-if="activeProject" class="mask">
      <div class="sheet">
        <div class="sheet-head">
          <h3>{{ activeProject.name }} 部署记录</h3>
          <button class="close" @click="activeProject = null">关闭</button>
        </div>
        <div v-if="pagesDeployments.length === 0" class="empty">暂无部署记录</div>
        <div class="list">
          <div v-for="d in pagesDeployments" :key="d.id" class="item">
            <div class="item-main">
              <div class="item-title">{{ d.environment }} · {{ formatDate(d.created_on) }}</div>
              <div class="item-sub">{{ d.url }}</div>
              <div class="item-sub" v-if="d.latest_stage">
                状态：{{ d.latest_stage.name }}（{{ d.latest_stage.status }}）
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wp {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head h2 {
  margin: 0;
  font-size: 18px;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tabs {
  display: flex;
  gap: 8px;
}
.tabs button {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: #aab3c5;
  font-size: 13px;
  cursor: pointer;
}
.tabs button.active {
  background: rgba(249, 162, 34, 0.15);
  color: #f69a22;
  border-color: rgba(249, 162, 34, 0.4);
}
.err {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 122, 110, 0.12);
  color: #ff7a6e;
  font-size: 13px;
}
.empty {
  padding: 32px 0;
  text-align: center;
  color: #6b768a;
  font-size: 13px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
}
.item-main {
  min-width: 0;
  flex: 1;
}
.item-title {
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}
.item-sub {
  font-size: 12px;
  color: #8b95a9;
  margin-top: 2px;
  word-break: break-all;
}
.item-arrow {
  color: #5d6879;
  font-size: 20px;
}
.mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}
.sheet {
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 20px 20px 28px;
  border-radius: 18px 18px 0 0;
  background: #121a2c;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.sheet-head h3 {
  margin: 0;
  font-size: 16px;
}
.close {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #aab3c5;
  font-size: 12px;
  cursor: pointer;
}
.code {
  font-size: 11px;
  line-height: 1.6;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 10px;
  padding: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: #c8d3e8;
  max-height: 50vh;
  overflow-y: auto;
}
</style>