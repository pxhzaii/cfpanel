<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  listWorkers,
  getWorkerScript,
  listPagesProjects,
  listPagesDeployments,
  createPagesProject,
  deletePagesProject,
  getPagesEnvVars,
  setPagesEnvVar,
  deletePagesEnvVar,
  listWorkerSecrets,
  listWorkerBindings,
} from "../api/client";
import type { CfWorkerScript, CfPagesProject, CfPagesDeployment, CfPagesEnvVar, CfWorkerSecret, CfWorkerBinding } from "../api/types";

const tab = ref<"workers" | "pages">("workers");
const workers = ref<CfWorkerScript[]>([]);
const pages = ref<CfPagesProject[]>([]);
const loading = ref(false);
const error = ref("");
const confirmDelete = ref<string | null>(null);

// Worker 详情
const workerDetail = ref<string | null>(null);
const workerCode = ref("");
const workerSecrets = ref<CfWorkerSecret[]>([]);
const workerBindings = ref<CfWorkerBinding[]>([]);
const workerSubTab = ref<"code" | "secrets" | "bindings">("code");

// Pages 详情
const pagesDeployments = ref<CfPagesDeployment[]>([]);
const activeProject = ref<CfPagesProject | null>(null);
const projectSubTab = ref<"deployments" | "envs" | "settings">("deployments");
const envVars = ref<Record<string, CfPagesEnvVar>>({});
const showAddEnv = ref(false);
const newEnvName = ref("");
const newEnvValue = ref("");
const newEnvType = ref<"plain_text" | "secret_text">("plain_text");
const envTarget = ref<"production" | "preview">("production");
const confirmDeleteEnv = ref<string | null>(null);

// 创建项目
const showCreateProject = ref(false);
const newProjectName = ref("");
const newProjectBranch = ref("main");

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
  workerDetail.value = name;
  workerCode.value = "";
  workerSecrets.value = [];
  workerBindings.value = [];
  workerSubTab.value = "code";
  try {
    workerCode.value = await getWorkerScript(name);
  } catch (e) {
    error.value = (e as Error).message;
  }
  // 加载机密和绑定
  try {
    workerSecrets.value = await listWorkerSecrets(name);
  } catch { /* 静默 */ }
  try {
    workerBindings.value = await listWorkerBindings(name);
  } catch { /* 静默 */ }
}

async function openDeployments(p: CfPagesProject) {
  activeProject.value = p;
  projectSubTab.value = "deployments";
  pagesDeployments.value = [];
  envVars.value = {};
  try {
    pagesDeployments.value = await listPagesDeployments(p.name);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function loadEnvVars() {
  if (!activeProject.value) return;
  try {
    envVars.value = await getPagesEnvVars(activeProject.value.name, envTarget.value);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function addEnvVar() {
  if (!activeProject.value || !newEnvName.value.trim()) {
    error.value = "请输入变量名";
    return;
  }
  error.value = "";
  try {
    await setPagesEnvVar(
      activeProject.value.name,
      newEnvName.value.trim(),
      newEnvValue.value,
      envTarget.value,
      newEnvType.value
    );
    newEnvName.value = "";
    newEnvValue.value = "";
    showAddEnv.value = false;
    await loadEnvVars();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeEnvVar(name: string) {
  if (!activeProject.value) return;
  error.value = "";
  try {
    await deletePagesEnvVar(activeProject.value.name, name, envTarget.value);
    confirmDeleteEnv.value = null;
    await loadEnvVars();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function createProject() {
  if (!newProjectName.value.trim()) {
    error.value = "请输入项目名称";
    return;
  }
  error.value = "";
  try {
    await createPagesProject({
      name: newProjectName.value.trim(),
      production_branch: newProjectBranch.value || "main",
    });
    newProjectName.value = "";
    newProjectBranch.value = "main";
    showCreateProject.value = false;
    await loadPages();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeProject(p: CfPagesProject) {
  error.value = "";
  try {
    await deletePagesProject(p.name);
    confirmDelete.value = null;
    await loadPages();
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
    <div v-if="tab === 'workers' && !workerDetail">
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

    <!-- Worker 详情 -->
    <div v-else-if="tab === 'workers' && workerDetail" class="detail">
      <div class="kv-head">
        <button class="back" @click="workerDetail = null">‹ 返回</button>
        <span class="ns-title">{{ workerDetail }}</span>
      </div>
      <div class="sub-tabs">
        <button :class="{ active: workerSubTab === 'code' }" @click="workerSubTab = 'code'">代码</button>
        <button :class="{ active: workerSubTab === 'secrets' }" @click="workerSubTab = 'secrets'">
          机密（{{ workerSecrets.length }}）
        </button>
        <button :class="{ active: workerSubTab === 'bindings' }" @click="workerSubTab = 'bindings'">
          绑定（{{ workerBindings.length }}）
        </button>
      </div>

      <pre v-if="workerSubTab === 'code'" class="code">{{ workerCode || "加载中…" }}</pre>

      <div v-if="workerSubTab === 'secrets'">
        <div v-if="workerSecrets.length === 0" class="empty">暂无机密变量</div>
        <div class="list">
          <div v-for="s in workerSecrets" :key="s.name" class="item">
            <div class="item-main">
              <div class="item-title">{{ s.name }}</div>
              <div class="item-sub">{{ s.type }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="workerSubTab === 'bindings'">
        <div v-if="workerBindings.length === 0" class="empty">暂无绑定</div>
        <div class="list">
          <div v-for="(b, i) in workerBindings" :key="i" class="item">
            <div class="item-main">
              <div class="item-title">{{ b.name }}</div>
              <div class="item-sub">{{ b.type }}<template v-if="b.bucket_name"> · {{ b.bucket_name }}</template><template v-if="b.namespace_id"> · {{ b.namespace_id }}</template><template v-if="b.database_id"> · {{ b.database_id }}</template></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pages 列表 -->
    <div v-if="tab === 'pages' && !activeProject">
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="pages.length === 0" class="empty">暂无 Pages 项目</div>
      <div class="list">
        <div v-for="p in pages" :key="p.id" class="item" @click="openDeployments(p)">
          <div class="item-main">
            <div class="item-title">{{ p.name }}</div>
            <div class="item-sub">{{ p.subdomain }}</div>
            <div class="item-sub" v-if="p.domains?.length">绑定域名：{{ p.domains.join("、") }}</div>
          </div>
          <div class="item-side">
            <button class="del-btn" @click.stop="confirmDelete = `page:${p.id}`" v-if="confirmDelete !== `page:${p.id}`">删除</button>
            <div v-else class="confirm-box">
              <button class="danger sm" @click.stop="removeProject(p)">确认</button>
              <button class="sm" @click.stop="confirmDelete = null">取消</button>
            </div>
            <div class="item-arrow">›</div>
          </div>
        </div>
      </div>
      <button class="add-btn" @click="showCreateProject = true">+ 新建 Pages 项目</button>
    </div>

    <!-- Pages 项目详情 -->
    <div v-if="tab === 'pages' && activeProject" class="detail">
      <div class="kv-head">
        <button class="back" @click="activeProject = null">‹ 返回</button>
        <span class="ns-title">{{ activeProject.name }}</span>
      </div>
      <div class="sub-tabs">
        <button :class="{ active: projectSubTab === 'deployments' }" @click="projectSubTab = 'deployments'">部署</button>
        <button :class="{ active: projectSubTab === 'envs' }" @click="projectSubTab = 'envs'; loadEnvVars()">环境变量</button>
        <button :class="{ active: projectSubTab === 'settings' }" @click="projectSubTab = 'settings'">设置</button>
      </div>

      <!-- 部署记录 -->
      <div v-if="projectSubTab === 'deployments'">
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

      <!-- 环境变量 -->
      <div v-if="projectSubTab === 'envs'">
        <div class="env-bar">
          <select v-model="envTarget" @change="loadEnvVars" class="env-select">
            <option value="production">Production</option>
            <option value="preview">Preview</option>
          </select>
          <button class="primary" @click="showAddEnv = true">+ 添加变量</button>
        </div>
        <div v-if="Object.keys(envVars).length === 0" class="empty">暂无环境变量</div>
        <div class="list">
          <div v-for="(v, k) in envVars" :key="k" class="item">
            <div class="item-main">
              <div class="item-title">{{ k }}</div>
              <div class="item-sub">
                {{ v.type === "secret_text" ? "机密" : (v.value ?? "") }}
              </div>
            </div>
            <button class="del-btn" @click="confirmDeleteEnv = k" v-if="confirmDeleteEnv !== k">删除</button>
            <div v-else class="confirm-box">
              <button class="danger sm" @click="removeEnvVar(k)">确认</button>
              <button class="sm" @click="confirmDeleteEnv = null">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 设置 -->
      <div v-if="projectSubTab === 'settings'">
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">项目名</span>
            <span class="info-val">{{ activeProject.name }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">子域名</span>
            <span class="info-val">{{ activeProject.subdomain }}</span>
          </div>
          <div class="info-row" v-if="activeProject.source?.type">
            <span class="info-label">来源</span>
            <span class="info-val">{{ activeProject.source.type }}</span>
          </div>
          <div class="info-row" v-if="activeProject.source?.config">
            <span class="info-label">仓库</span>
            <span class="info-val">{{ (activeProject.source.config as Record<string, unknown>).owner ?? "" }}/{{ (activeProject.source.config as Record<string, unknown>).repo_name ?? "" }}</span>
          </div>
          <div class="info-row" v-if="activeProject.build_config?.build_command">
            <span class="info-label">构建命令</span>
            <span class="info-val">{{ activeProject.build_config.build_command }}</span>
          </div>
          <div class="info-row" v-if="activeProject.build_config?.destination_dir">
            <span class="info-label">输出目录</span>
            <span class="info-val">{{ activeProject.build_config.destination_dir }}</span>
          </div>
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
    <div v-if="activeProject && projectSubTab === 'deployments'" class="mask">
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

    <!-- 添加环境变量弹层 -->
    <div v-if="showAddEnv" class="mask" @click.self="showAddEnv = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>添加环境变量</h3>
          <button class="close" @click="showAddEnv = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            变量名
            <input v-model="newEnvName" placeholder="如：API_TOKEN" @keyup.enter="addEnvVar" />
          </label>
          <label>
            值
            <textarea v-model="newEnvValue" rows="3" placeholder="变量值"></textarea>
          </label>
          <label>
            类型
            <select v-model="newEnvType">
              <option value="plain_text">明文</option>
              <option value="secret_text">机密（加密存储）</option>
            </select>
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="addEnvVar">添加</button>
        </div>
      </div>
    </div>

    <!-- 创建 Pages 项目弹层 -->
    <div v-if="showCreateProject" class="mask" @click.self="showCreateProject = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>新建 Pages 项目</h3>
          <button class="close" @click="showCreateProject = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            项目名称
            <input v-model="newProjectName" placeholder="如：my-project" @keyup.enter="createProject" />
          </label>
          <label>
            生产分支
            <input v-model="newProjectBranch" placeholder="main" />
          </label>
        </div>
        <p class="hint">创建后可在 Cloudflare 控制台连接 GitHub 仓库，或通过 wrangler 直接上传部署。</p>
        <div class="btns">
          <button class="primary" @click="createProject">创建</button>
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
.item-side {
  display: flex;
  align-items: center;
  gap: 8px;
}
.del-btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 93, 77, 0.3);
  background: transparent;
  color: #ff7a6e;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.confirm-box {
  display: flex;
  gap: 4px;
}
.sm {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #aab3c5;
  font-size: 12px;
  cursor: pointer;
}
.confirm-box .danger {
  padding: 4px 8px;
  font-size: 12px;
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.kv-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.back {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #aab3c5;
  font-size: 13px;
  cursor: pointer;
}
.ns-title {
  font-weight: 600;
  font-size: 14px;
  word-break: break-all;
}
.sub-tabs {
  display: flex;
  gap: 8px;
}
.sub-tabs button {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: #aab3c5;
  font-size: 12px;
  cursor: pointer;
}
.sub-tabs button.active {
  background: rgba(249, 162, 34, 0.15);
  color: #f69a22;
  border-color: rgba(249, 162, 34, 0.4);
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
.env-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.env-select {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 13px;
  outline: none;
}
.env-select option {
  background: #121a2c;
}
.primary {
  padding: 8px 14px;
  border: none;
  border-radius: 10px;
  background: #f69a22;
  color: #0b1220;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
.add-btn {
  margin-top: 12px;
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: 1px dashed rgba(249, 162, 34, 0.4);
  background: transparent;
  color: #f69a22;
  font-size: 13px;
  cursor: pointer;
}
.info-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.info-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info-label {
  font-size: 11px;
  color: #6b768a;
}
.info-val {
  font-size: 13px;
  color: #e8edf5;
  word-break: break-all;
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
.fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fields label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #8b95a9;
}
.fields input,
.fields textarea,
.fields select {
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  resize: vertical;
}
.fields select option {
  background: #121a2c;
}
.hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b768a;
  line-height: 1.5;
}
.btns {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  justify-content: flex-end;
}
.danger {
  padding: 8px 14px;
  border: none;
  border-radius: 10px;
  background: #ff5d4d;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
</style>
