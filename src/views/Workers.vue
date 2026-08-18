<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  listWorkers,
  getWorkerScript,
  createWorkerScript,
  deleteWorkerScript,
  listPagesProjects,
  listPagesDeployments,
  createPagesProject,
  deletePagesProject,
  getPagesProject,
  createPagesDeployment,
  getPagesEnvVars,
  setPagesEnvVar,
  deletePagesEnvVar,
  updatePagesBindings,
  listWorkerSecrets,
  setWorkerSecret,
  deleteWorkerSecret,
  listWorkerBindings,
  getWorkerSettings,
  updateWorkerBindings,
  listKvNamespaces,
  listR2Buckets,
  listD1Databases,
} from "../api/client";
import type {
  CfWorkerScript,
  CfPagesProject,
  CfPagesDeployment,
  CfPagesEnvVar,
  CfWorkerSecret,
  CfWorkerBinding,
  CfPagesBindingEntry,
  CfKvNamespace,
  CfR2Bucket,
  CfD1Database,
} from "../api/types";

const tab = ref<"workers" | "pages">("workers");
const workers = ref<CfWorkerScript[]>([]);
const pages = ref<CfPagesProject[]>([]);
const loadingWorkers = ref(false);
const loadingPages = ref(false);
const error = ref("");
const confirmDelete = ref<string | null>(null);

// Worker 详情
const workerDetail = ref<string | null>(null);
const workerCode = ref("");
const workerSecrets = ref<CfWorkerSecret[]>([]);
const workerBindings = ref<CfWorkerBinding[]>([]);
const workerSubTab = ref<"code" | "secrets" | "bindings">("code");

// Worker 新建
const showCreateWorker = ref(false);
const newWorkerName = ref("");
const newWorkerCode = ref("");
const newWorkerUseGithub = ref(false);
const newWorkerGithubOwner = ref("");
const newWorkerGithubRepo = ref("");
const newWorkerBuildCommand = ref("");
const newWorkerDeployCommand = ref("");
const newWorkerDestDir = ref("");
const newWorkerRootDir = ref("");

// Worker 新建 - 环境变量
const newWorkerEnvs = ref<Array<{ name: string; value: string; type: "plain_text" | "secret_text" }>>([]);

// Worker 机密增删
const showAddSecret = ref(false);
const newSecretName = ref("");
const newSecretValue = ref("");
const confirmDeleteSecret = ref<string | null>(null);

// Worker 绑定增删
const showAddBinding = ref(false);
const newBindingType = ref<"kv_namespace" | "r2_bucket" | "d1_database" | "plain_text">("kv_namespace");
const newBindingName = ref("");
const newBindingValue = ref("");
const newBindingResource = ref("");
const kvList = ref<CfKvNamespace[]>([]);
const r2List = ref<CfR2Bucket[]>([]);
const d1List = ref<CfD1Database[]>([]);
const confirmDeleteBinding = ref<string | null>(null);

// Pages 详情
const pagesDeployments = ref<CfPagesDeployment[]>([]);
const activeProject = ref<CfPagesProject | null>(null);
const projectSubTab = ref<"deployments" | "envs" | "bindings" | "settings">("deployments");
const deploying = ref(false);
const envVars = ref<Record<string, CfPagesEnvVar>>({});
const showAddEnv = ref(false);
const newEnvName = ref("");
const newEnvValue = ref("");
const newEnvType = ref<"plain_text" | "secret_text">("plain_text");
const envTarget = ref<"production" | "preview">("production");
const confirmDeleteEnv = ref<string | null>(null);

// Pages 绑定管理
const pagesBindings = ref<{
  kv: CfPagesBindingEntry[];
  r2: CfPagesBindingEntry[];
  d1: CfPagesBindingEntry[];
}>({ kv: [], r2: [], d1: [] });
const pagesBindingsTarget = ref<"production" | "preview">("production");
const showAddPagesBinding = ref(false);
const newPagesBindingType = ref<"kv_namespaces" | "r2_buckets" | "d1_databases">("kv_namespaces");
const newPagesBindingVarName = ref("");
const newPagesBindingResource = ref("");
const confirmDeletePagesBinding = ref<string | null>(null);

// 创建项目
const showCreateProject = ref(false);
const newProjectName = ref("");
const newProjectBranch = ref("main");
const newProjectUseGithub = ref(false);
const newProjectGithubOwner = ref("");
const newProjectGithubRepo = ref("");
const newProjectBuildCommand = ref("");
const newProjectDestDir = ref("");
const newProjectRootDir = ref("");
const newProjectFramework = ref("");

// Pages 新建 - 环境变量
const newProjectEnvs = ref<Array<{ name: string; value: string; type: "plain_text" | "secret_text" }>>([]);

const counts = computed(() => ({
  workers: workers.value.length,
  pages: pages.value.length,
}));

async function loadWorkers() {
  loadingWorkers.value = true;
  error.value = "";
  try {
    workers.value = await listWorkers();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loadingWorkers.value = false;
  }
}

async function loadPages() {
  loadingPages.value = true;
  error.value = "";
  try {
    pages.value = await listPagesProjects();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loadingPages.value = false;
  }
}

async function loadResourceLists() {
  try {
    const [kvs, r2s, d1s] = await Promise.all([
      listKvNamespaces().catch(() => []),
      listR2Buckets().catch(() => []),
      listD1Databases().catch(() => []),
    ]);
    kvList.value = kvs;
    r2List.value = r2s;
    d1List.value = d1s;
  } catch { /* 静默 */ }
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
  try {
    workerSecrets.value = await listWorkerSecrets(name);
  } catch { /* 静默 */ }
  try {
    workerBindings.value = await listWorkerBindings(name);
  } catch { /* 静默 */ }
}

async function createWorker() {
  if (!newWorkerName.value.trim()) {
    error.value = "请输入 Worker 名称";
    return;
  }
  if (!newWorkerUseGithub.value && !newWorkerCode.value.trim()) {
    error.value = "请输入 Worker 代码，或选择连接 GitHub 仓库";
    return;
  }
  if (newWorkerUseGithub.value && (!newWorkerGithubOwner.value.trim() || !newWorkerGithubRepo.value.trim())) {
    error.value = "请填写 GitHub 仓库所有者和仓库名";
    return;
  }
  error.value = "";
  try {
    const params: Record<string, unknown> = { name: newWorkerName.value.trim() };
    if (newWorkerUseGithub.value) {
      params.source = {
        type: "github",
        config: {
          owner: newWorkerGithubOwner.value.trim(),
          repo_name: newWorkerGithubRepo.value.trim(),
          production_branch: "main",
          deployments_enabled: true,
        },
      };
    } else {
      params.code = newWorkerCode.value;
    }
    if (newWorkerBuildCommand.value.trim() || newWorkerDeployCommand.value.trim() || newWorkerDestDir.value.trim() || newWorkerRootDir.value.trim()) {
      const buildConfig: Record<string, string> = {};
      if (newWorkerBuildCommand.value.trim()) buildConfig.build_command = newWorkerBuildCommand.value.trim();
      if (newWorkerDeployCommand.value.trim()) buildConfig.deploy_command = newWorkerDeployCommand.value.trim();
      if (newWorkerDestDir.value.trim()) buildConfig.destination_dir = newWorkerDestDir.value.trim();
      if (newWorkerRootDir.value.trim()) buildConfig.root_dir = newWorkerRootDir.value.trim();
      params.build_config = buildConfig;
    }
    await createWorkerScript(params as unknown as Parameters<typeof createWorkerScript>[0]);
    // 设置环境变量
    const envErrors: string[] = [];
    for (const env of newWorkerEnvs.value) {
      if (!env.name.trim()) continue;
      try {
        if (env.type === "secret_text") {
          await setWorkerSecret(newWorkerName.value.trim(), env.name.trim(), env.value);
        }
      } catch (e) {
        envErrors.push(`${env.name}: ${(e as Error).message}`);
      }
    }
    // 批量设置明文变量（作为 Worker plain_text 绑定）
    const plainTextVars = newWorkerEnvs.value.filter((e) => e.type === "plain_text" && e.name.trim());
    if (plainTextVars.length > 0) {
      try {
        const bindings: CfWorkerBinding[] = plainTextVars.map((e) => ({
          type: "plain_text",
          name: e.name.trim(),
          text: e.value,
        }));
        await updateWorkerBindings(newWorkerName.value.trim(), bindings);
      } catch (e) {
        envErrors.push(`明文变量: ${(e as Error).message}`);
      }
    }
    if (envErrors.length > 0) {
      error.value = `Worker 已创建，但部分环境变量设置失败：\n${envErrors.join("\n")}`;
    }
    newWorkerName.value = "";
    newWorkerCode.value = "";
    newWorkerUseGithub.value = false;
    newWorkerGithubOwner.value = "";
    newWorkerGithubRepo.value = "";
    newWorkerBuildCommand.value = "";
    newWorkerDeployCommand.value = "";
    newWorkerDestDir.value = "";
    newWorkerRootDir.value = "";
    newWorkerEnvs.value = [];
    showCreateWorker.value = false;
    await loadWorkers();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeWorker(name: string) {
  error.value = "";
  try {
    await deleteWorkerScript(name);
    confirmDelete.value = null;
    await loadWorkers();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function addWorkerSecret() {
  if (!workerDetail.value || !newSecretName.value.trim()) {
    error.value = "请输入变量名";
    return;
  }
  error.value = "";
  try {
    await setWorkerSecret(workerDetail.value, newSecretName.value.trim(), newSecretValue.value);
    newSecretName.value = "";
    newSecretValue.value = "";
    showAddSecret.value = false;
    workerSecrets.value = await listWorkerSecrets(workerDetail.value);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeWorkerSecret(secretName: string) {
  if (!workerDetail.value) return;
  error.value = "";
  try {
    await deleteWorkerSecret(workerDetail.value, secretName);
    confirmDeleteSecret.value = null;
    workerSecrets.value = await listWorkerSecrets(workerDetail.value);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function addWorkerBinding() {
  if (!workerDetail.value || !newBindingName.value.trim()) {
    error.value = "请输入绑定变量名";
    return;
  }
  error.value = "";
  try {
    // 获取当前设置中的完整绑定列表
    const settings = await getWorkerSettings(workerDetail.value);
    const currentBindings = settings.bindings ?? [];
    // 构造新绑定
    const binding: CfWorkerBinding = { type: newBindingType.value, name: newBindingName.value.trim() };
    if (newBindingType.value === "kv_namespace" && newBindingResource.value) {
      binding.namespace_id = newBindingResource.value;
    } else if (newBindingType.value === "r2_bucket" && newBindingResource.value) {
      binding.bucket_name = newBindingResource.value;
    } else if (newBindingType.value === "d1_database" && newBindingResource.value) {
      binding.database_id = newBindingResource.value;
    } else if (newBindingType.value === "plain_text") {
      binding.text = newBindingValue.value;
    }
    currentBindings.push(binding);
    await updateWorkerBindings(workerDetail.value, currentBindings);
    newBindingName.value = "";
    newBindingValue.value = "";
    newBindingResource.value = "";
    showAddBinding.value = false;
    workerBindings.value = await listWorkerBindings(workerDetail.value);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeWorkerBinding(idx: number) {
  if (!workerDetail.value) return;
  error.value = "";
  try {
    const settings = await getWorkerSettings(workerDetail.value);
    const currentBindings = settings.bindings ?? [];
    const filtered = currentBindings.filter((_, i) => i !== idx);
    await updateWorkerBindings(workerDetail.value, filtered);
    confirmDeleteBinding.value = null;
    workerBindings.value = await listWorkerBindings(workerDetail.value);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function openDeployments(p: CfPagesProject) {
  activeProject.value = p;
  projectSubTab.value = "deployments";
  pagesDeployments.value = [];
  envVars.value = {};
  pagesBindings.value = { kv: [], r2: [], d1: [] };
  pagesBindingsTarget.value = "production";
  try {
    pagesDeployments.value = await listPagesDeployments(p.name);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function triggerDeploy() {
  if (!activeProject.value || deploying.value) return;
  error.value = "";
  deploying.value = true;
  try {
    const result = await createPagesDeployment(activeProject.value.name);
    // 显示部署触发结果消息
    error.value = result.message;
    // 等待几秒后刷新部署列表
    await new Promise((r) => setTimeout(r, 3000));
    pagesDeployments.value = await listPagesDeployments(activeProject.value.name);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    deploying.value = false;
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

async function loadPagesBindings() {
  if (!activeProject.value) return;
  try {
    const proj = await getPagesProject(activeProject.value.name);
    const cfg = proj.deployment_configs?.[pagesBindingsTarget.value];
    // CF API 返回 map 对象（key 为变量名），转换为 UI 数组格式
    const kvMap = cfg?.kv_namespaces ?? {};
    const r2Map = cfg?.r2_buckets ?? {};
    const d1Map = cfg?.d1_databases ?? {};
    pagesBindings.value = {
      kv: Object.entries(kvMap).map(([variable_name, v]) => ({
        variable_name,
        namespace_id: v?.namespace_id,
      })),
      r2: Object.entries(r2Map).map(([variable_name, v]) => ({
        variable_name,
        bucket_name: v?.name,
      })),
      d1: Object.entries(d1Map).map(([variable_name, v]) => ({
        variable_name,
        id: v?.id,
      })),
    };
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function addPagesBinding() {
  if (!activeProject.value || !newPagesBindingVarName.value.trim()) {
    error.value = "请输入变量名";
    return;
  }
  if (!newPagesBindingResource.value) {
    error.value = "请选择资源";
    return;
  }
  error.value = "";
  try {
    const btype = newPagesBindingType.value;
    const current = [...pagesBindings.value[
      btype === "kv_namespaces" ? "kv" : btype === "r2_buckets" ? "r2" : "d1"
    ]];
    const newBinding: CfPagesBindingEntry = {
      variable_name: newPagesBindingVarName.value.trim(),
    };
    if (btype === "kv_namespaces") {
      newBinding.namespace_id = newPagesBindingResource.value;
    } else if (btype === "r2_buckets") {
      newBinding.bucket_name = newPagesBindingResource.value;
    } else if (btype === "d1_databases") {
      newBinding.id = newPagesBindingResource.value;
    }
    current.push(newBinding);
    await updatePagesBindings(activeProject.value.name, pagesBindingsTarget.value, btype, current);
    newPagesBindingVarName.value = "";
    newPagesBindingResource.value = "";
    showAddPagesBinding.value = false;
    await loadPagesBindings();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removePagesBinding(btype: "kv" | "r2" | "d1", idx: number) {
  if (!activeProject.value) return;
  error.value = "";
  try {
    const apiKey =
      btype === "kv" ? "kv_namespaces" : btype === "r2" ? "r2_buckets" : "d1_databases";
    const current = [...pagesBindings.value[btype]];
    // CF API 绑定是合并语义，不能直接整体替换删除，必须显式把删除项设为 null
    const removed = current[idx];
    const keep = current.filter((_, i) => i !== idx);
    await updatePagesBindings(
      activeProject.value.name,
      pagesBindingsTarget.value,
      apiKey,
      keep,
      removed ? [removed.variable_name] : []
    );
    confirmDeletePagesBinding.value = null;
    await loadPagesBindings();
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
    const params: Record<string, unknown> = {
      name: newProjectName.value.trim(),
      production_branch: newProjectBranch.value || "main",
    };
    if (newProjectUseGithub.value && newProjectGithubOwner.value.trim() && newProjectGithubRepo.value.trim()) {
      params.source = {
        type: "github",
        config: {
          owner: newProjectGithubOwner.value.trim(),
          repo_name: newProjectGithubRepo.value.trim(),
          production_branch: newProjectBranch.value || "main",
          deployments_enabled: true,
        },
      };
    }
    // 构建配置
    const buildConfig: Record<string, string> = {};
    if (newProjectFramework.value) buildConfig.framework = newProjectFramework.value;
    if (newProjectBuildCommand.value.trim()) buildConfig.build_command = newProjectBuildCommand.value.trim();
    if (newProjectDestDir.value.trim()) buildConfig.destination_dir = newProjectDestDir.value.trim();
    if (newProjectRootDir.value.trim()) buildConfig.root_dir = newProjectRootDir.value.trim();
    if (Object.keys(buildConfig).length > 0) {
      params.build_config = buildConfig;
    }
    await createPagesProject(params as unknown as Parameters<typeof createPagesProject>[0]);
    // 设置环境变量
    const projEnvErrors: string[] = [];
    for (const env of newProjectEnvs.value) {
      if (!env.name.trim()) continue;
      try {
        await setPagesEnvVar(
          newProjectName.value.trim(),
          env.name.trim(),
          env.value,
          "production",
          env.type
        );
      } catch (e) {
        projEnvErrors.push(`${env.name}: ${(e as Error).message}`);
      }
    }
    if (projEnvErrors.length > 0) {
      error.value = `项目已创建，但部分环境变量设置失败：\n${projEnvErrors.join("\n")}`;
    }
    newProjectName.value = "";
    newProjectBranch.value = "main";
    newProjectUseGithub.value = false;
    newProjectGithubOwner.value = "";
    newProjectGithubRepo.value = "";
    newProjectBuildCommand.value = "";
    newProjectDestDir.value = "";
    newProjectRootDir.value = "";
    newProjectFramework.value = "";
    newProjectEnvs.value = [];
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
  loadResourceLists();
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
      <div v-if="loadingWorkers" class="empty">加载中…</div>
      <div v-else-if="workers.length === 0" class="empty">暂无 Workers 脚本</div>
      <div class="list">
        <div v-for="w in workers" :key="w.id" class="item" @click="openWorker(w.id)">
          <div class="item-main">
            <div class="item-title">{{ w.id }}</div>
            <div class="item-sub">更新于 {{ formatDate(w.modified_on) }}</div>
          </div>
          <div class="item-side">
            <button class="del-btn" @click.stop="confirmDelete = `worker:${w.id}`" v-if="confirmDelete !== `worker:${w.id}`">删除</button>
            <div v-else class="confirm-box">
              <button class="danger sm" @click.stop="removeWorker(w.id)">确认</button>
              <button class="sm" @click.stop="confirmDelete = null">取消</button>
            </div>
            <div class="item-arrow">›</div>
          </div>
        </div>
      </div>
      <button class="add-btn" @click="showCreateWorker = true">+ 新建 Worker</button>
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

      <!-- Worker 机密 -->
      <div v-if="workerSubTab === 'secrets'">
        <button class="add-btn" @click="showAddSecret = true">+ 添加机密</button>
        <div v-if="workerSecrets.length === 0" class="empty">暂无机密变量</div>
        <div class="list">
          <div v-for="s in workerSecrets" :key="s.name" class="item">
            <div class="item-main">
              <div class="item-title">{{ s.name }}</div>
              <div class="item-sub">{{ s.type }}</div>
            </div>
            <button class="del-btn" @click="confirmDeleteSecret = s.name" v-if="confirmDeleteSecret !== s.name">删除</button>
            <div v-else class="confirm-box">
              <button class="danger sm" @click="removeWorkerSecret(s.name)">确认</button>
              <button class="sm" @click="confirmDeleteSecret = null">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Worker 绑定 -->
      <div v-if="workerSubTab === 'bindings'">
        <button class="add-btn" @click="showAddBinding = true">+ 添加绑定</button>
        <div v-if="workerBindings.length === 0" class="empty">暂无绑定</div>
        <div class="list">
          <div v-for="(b, i) in workerBindings" :key="i" class="item">
            <div class="item-main">
              <div class="item-title">{{ b.name }}</div>
              <div class="item-sub">
                {{ b.type }}
                <template v-if="b.bucket_name"> · {{ b.bucket_name }}</template>
                <template v-if="b.namespace_id"> · {{ b.namespace_id }}</template>
                <template v-if="b.database_id"> · {{ b.database_id }}</template>
                <template v-if="b.text"> · {{ b.text }}</template>
              </div>
            </div>
            <button class="del-btn" @click="confirmDeleteBinding = String(i)" v-if="confirmDeleteBinding !== String(i)">删除</button>
            <div v-else class="confirm-box">
              <button class="danger sm" @click="removeWorkerBinding(i)">确认</button>
              <button class="sm" @click="confirmDeleteBinding = null">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pages 列表 -->
    <div v-if="tab === 'pages' && !activeProject">
      <div v-if="loadingPages" class="empty">加载中…</div>
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
        <button :class="{ active: projectSubTab === 'bindings' }" @click="projectSubTab = 'bindings'; loadPagesBindings()">绑定</button>
        <button :class="{ active: projectSubTab === 'settings' }" @click="projectSubTab = 'settings'">设置</button>
      </div>

      <!-- 部署记录 -->
      <div v-if="projectSubTab === 'deployments'">
        <div class="env-bar">
          <button class="primary" @click="triggerDeploy" :disabled="deploying">{{ deploying ? "部署中…" : "重新部署" }}</button>
        </div>
        <div v-if="pagesDeployments.length === 0" class="empty">暂无部署记录</div>
        <div class="list">
          <div v-for="d in pagesDeployments" :key="d.id" class="item">
            <div class="item-main">
              <div class="item-title">{{ d.environment === "production" ? "生产" : "预览" }} · {{ formatDate(d.created_on) }}</div>
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
            <option value="production">生产</option>
            <option value="preview">预览</option>
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

      <!-- 绑定 -->
      <div v-if="projectSubTab === 'bindings'">
        <div class="env-bar">
          <select v-model="pagesBindingsTarget" @change="loadPagesBindings" class="env-select">
            <option value="production">生产</option>
            <option value="preview">预览</option>
          </select>
          <button class="primary" @click="showAddPagesBinding = true">+ 添加绑定</button>
        </div>

        <!-- KV 绑定 -->
        <div class="binding-section">
          <div class="binding-title">KV 命名空间（{{ pagesBindings.kv.length }}）</div>
          <div v-if="pagesBindings.kv.length === 0" class="empty-sm">暂无 KV 绑定</div>
          <div class="list">
            <div v-for="(b, i) in pagesBindings.kv" :key="`kv-${i}`" class="item">
              <div class="item-main">
                <div class="item-title">{{ b.variable_name }}</div>
                <div class="item-sub">namespace_id: {{ b.namespace_id }}</div>
              </div>
              <button class="del-btn" @click="confirmDeletePagesBinding = `kv-${i}`" v-if="confirmDeletePagesBinding !== `kv-${i}`">删除</button>
              <div v-else class="confirm-box">
                <button class="danger sm" @click="removePagesBinding('kv', i)">确认</button>
                <button class="sm" @click="confirmDeletePagesBinding = null">取消</button>
              </div>
            </div>
          </div>
        </div>

        <!-- R2 绑定 -->
        <div class="binding-section">
          <div class="binding-title">R2 存储桶（{{ pagesBindings.r2.length }}）</div>
          <div v-if="pagesBindings.r2.length === 0" class="empty-sm">暂无 R2 绑定</div>
          <div class="list">
            <div v-for="(b, i) in pagesBindings.r2" :key="`r2-${i}`" class="item">
              <div class="item-main">
                <div class="item-title">{{ b.variable_name }}</div>
                <div class="item-sub">bucket_name: {{ b.bucket_name }}</div>
              </div>
              <button class="del-btn" @click="confirmDeletePagesBinding = `r2-${i}`" v-if="confirmDeletePagesBinding !== `r2-${i}`">删除</button>
              <div v-else class="confirm-box">
                <button class="danger sm" @click="removePagesBinding('r2', i)">确认</button>
                <button class="sm" @click="confirmDeletePagesBinding = null">取消</button>
              </div>
            </div>
          </div>
        </div>

        <!-- D1 绑定 -->
        <div class="binding-section">
          <div class="binding-title">D1 数据库（{{ pagesBindings.d1.length }}）</div>
          <div v-if="pagesBindings.d1.length === 0" class="empty-sm">暂无 D1 绑定</div>
          <div class="list">
            <div v-for="(b, i) in pagesBindings.d1" :key="`d1-${i}`" class="item">
              <div class="item-main">
                <div class="item-title">{{ b.variable_name }}</div>
                <div class="item-sub">database_id: {{ b.id }}</div>
              </div>
              <button class="del-btn" @click="confirmDeletePagesBinding = `d1-${i}`" v-if="confirmDeletePagesBinding !== `d1-${i}`">删除</button>
              <div v-else class="confirm-box">
                <button class="danger sm" @click="removePagesBinding('d1', i)">确认</button>
                <button class="sm" @click="confirmDeletePagesBinding = null">取消</button>
              </div>
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
      <div class="info-row" v-if="activeProject.framework">
            <span class="info-label">框架</span>
            <span class="info-val">{{ activeProject.framework }}</span>
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
      <div class="info-row" v-if="activeProject.build_config?.root_dir">
            <span class="info-label">根目录</span>
            <span class="info-val">{{ activeProject.build_config.root_dir }}</span>
          </div>
          <div class="info-row" v-if="activeProject.production_branch">
            <span class="info-label">生产分支</span>
            <span class="info-val">{{ activeProject.production_branch }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建 Worker 弹层 -->
    <div v-if="showCreateWorker" class="mask" @click.self="showCreateWorker = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>新建 Worker</h3>
          <button class="close" @click="showCreateWorker = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            Worker 名称
            <input v-model="newWorkerName" placeholder="如：my-worker" @keyup.enter="createWorker" />
          </label>

          <label class="checkbox-row">
            <input type="checkbox" v-model="newWorkerUseGithub" />
            <span>连接 GitHub 仓库</span>
          </label>

          <template v-if="newWorkerUseGithub">
            <label>
              GitHub 仓库所有者
              <input v-model="newWorkerGithubOwner" placeholder="如：pxhzaii" />
            </label>
            <label>
              GitHub 仓库名
              <input v-model="newWorkerGithubRepo" placeholder="如：my-worker" />
            </label>
            <p class="hint">需先在 Cloudflare 控制台授权 Workers GitHub App 访问对应仓库。创建后可自动部署。</p>
          </template>
          <template v-else>
            <label>
              脚本代码
              <textarea v-model="newWorkerCode" rows="6" placeholder='export default {\n  async fetch(request, env, ctx) {\n    return new Response("Hello World!");\n  },\n};' class="code-input"></textarea>
            </label>
          </template>

          <div class="section-divider">构建配置（可选）</div>
          <label>
            构建命令
            <input v-model="newWorkerBuildCommand" placeholder="如：npm run build" />
          </label>
          <label>
            部署命令
            <input v-model="newWorkerDeployCommand" placeholder="如：npx wrangler deploy" />
          </label>
          <label>
            部署目录（构建产物路径）
            <input v-model="newWorkerDestDir" placeholder="如：dist" />
          </label>
          <label>
            根目录（仓库子目录）
            <input v-model="newWorkerRootDir" placeholder="如：apps/worker" />
          </label>

          <div class="section-divider">环境变量（可选）</div>
          <div v-for="(env, i) in newWorkerEnvs" :key="`we-${i}`" class="env-row">
            <input v-model="env.name" placeholder="变量名" class="env-name" />
            <input v-model="env.value" placeholder="值" class="env-val" />
            <select v-model="env.type" class="env-type">
              <option value="plain_text">明文</option>
              <option value="secret_text">机密</option>
            </select>
            <button class="env-del" @click="newWorkerEnvs.splice(i, 1)">✕</button>
          </div>
          <button class="add-env-btn" @click="newWorkerEnvs.push({ name: '', value: '', type: 'plain_text' })">+ 添加环境变量</button>
        </div>
        <p v-if="!newWorkerUseGithub" class="hint">代码使用 ES 模块格式，创建后可在详情页添加机密变量和绑定。</p>
        <div class="btns">
          <button class="primary" @click="createWorker">创建</button>
        </div>
      </div>
    </div>

    <!-- 添加 Worker 机密弹层 -->
    <div v-if="showAddSecret" class="mask" @click.self="showAddSecret = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>添加机密变量</h3>
          <button class="close" @click="showAddSecret = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            变量名
            <input v-model="newSecretName" placeholder="如：API_TOKEN" @keyup.enter="addWorkerSecret" />
          </label>
          <label>
            值
            <textarea v-model="newSecretValue" rows="3" placeholder="机密值（加密存储，不可读取）"></textarea>
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="addWorkerSecret">添加</button>
        </div>
      </div>
    </div>

    <!-- 添加 Worker 绑定弹层 -->
    <div v-if="showAddBinding" class="mask" @click.self="showAddBinding = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>添加绑定</h3>
          <button class="close" @click="showAddBinding = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            绑定类型
            <select v-model="newBindingType">
              <option value="kv_namespace">KV 命名空间</option>
              <option value="r2_bucket">R2 存储桶</option>
              <option value="d1_database">D1 数据库</option>
              <option value="plain_text">明文变量</option>
            </select>
          </label>
          <label>
            变量名（在代码中引用的名称）
            <input v-model="newBindingName" placeholder="如：MY_KV" />
          </label>
          <label v-if="newBindingType === 'kv_namespace'">
            KV 命名空间
            <select v-model="newBindingResource">
              <option value="">请选择</option>
              <option v-for="kv in kvList" :key="kv.id" :value="kv.id">{{ kv.title }}</option>
            </select>
          </label>
          <label v-if="newBindingType === 'r2_bucket'">
            R2 存储桶
            <select v-model="newBindingResource">
              <option value="">请选择</option>
              <option v-for="r2 in r2List" :key="r2.name" :value="r2.name">{{ r2.name }}</option>
            </select>
          </label>
          <label v-if="newBindingType === 'd1_database'">
            D1 数据库
            <select v-model="newBindingResource">
              <option value="">请选择</option>
              <option v-for="d1 in d1List" :key="d1.uuid" :value="d1.uuid">{{ d1.name }}</option>
            </select>
          </label>
          <label v-if="newBindingType === 'plain_text'">
            变量值
            <input v-model="newBindingValue" placeholder="明文值" />
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="addWorkerBinding">添加</button>
        </div>
      </div>
    </div>

    <!-- 添加 Pages 绑定弹层 -->
    <div v-if="showAddPagesBinding" class="mask" @click.self="showAddPagesBinding = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>添加绑定</h3>
          <button class="close" @click="showAddPagesBinding = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            绑定类型
            <select v-model="newPagesBindingType">
              <option value="kv_namespaces">KV 命名空间</option>
              <option value="r2_buckets">R2 存储桶</option>
              <option value="d1_databases">D1 数据库</option>
            </select>
          </label>
          <label>
            变量名（在代码中引用的名称）
            <input v-model="newPagesBindingVarName" placeholder="如：MY_KV" />
          </label>
          <label v-if="newPagesBindingType === 'kv_namespaces'">
            KV 命名空间
            <select v-model="newPagesBindingResource">
              <option value="">请选择</option>
              <option v-for="kv in kvList" :key="kv.id" :value="kv.id">{{ kv.title }}</option>
            </select>
          </label>
          <label v-if="newPagesBindingType === 'r2_buckets'">
            R2 存储桶
            <select v-model="newPagesBindingResource">
              <option value="">请选择</option>
              <option v-for="r2 in r2List" :key="r2.name" :value="r2.name">{{ r2.name }}</option>
            </select>
          </label>
          <label v-if="newPagesBindingType === 'd1_databases'">
            D1 数据库
            <select v-model="newPagesBindingResource">
              <option value="">请选择</option>
              <option v-for="d1 in d1List" :key="d1.uuid" :value="d1.uuid">{{ d1.name }}</option>
            </select>
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="addPagesBinding">添加</button>
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

          <div class="section-divider">构建配置</div>
          <label>
            框架预设
            <select v-model="newProjectFramework">
              <option value="">无（自定义）</option>
              <option value="vue">Vue</option>
              <option value="react">React</option>
              <option value="next">Next.js</option>
              <option value="nuxt">Nuxt</option>
              <option value="svelte">Svelte</option>
              <option value="astro">Astro</option>
              <option value="angular">Angular</option>
              <option value="remix">Remix</option>
              <option value="hugo">Hugo</option>
              <option value="jekyll">Jekyll</option>
              <option value="gatsby">Gatsby</option>
              <option value="static">纯静态 HTML</option>
            </select>
          </label>
          <label>
            构建命令
            <input v-model="newProjectBuildCommand" placeholder="如：npm run build" />
          </label>
          <label>
            输出目录
            <input v-model="newProjectDestDir" placeholder="如：dist、build、public" />
          </label>
          <label>
            根目录（仓库子目录）
            <input v-model="newProjectRootDir" placeholder="留空则使用仓库根目录" />
          </label>

          <div class="section-divider">GitHub 仓库</div>
          <label class="checkbox-row">
            <input type="checkbox" v-model="newProjectUseGithub" />
            <span>连接 GitHub 仓库</span>
          </label>
          <template v-if="newProjectUseGithub">
            <label>
              GitHub 仓库所有者
              <input v-model="newProjectGithubOwner" placeholder="如：pxhzaii" />
            </label>
            <label>
              GitHub 仓库名
              <input v-model="newProjectGithubRepo" placeholder="如：my-project" />
            </label>
            <p class="hint">注意：通过面板创建的项目不会自动建立 GitHub Webhook，推代码不会自动触发部署。创建后请到项目详情 → 部署 → 点击"重新部署"手动触发首次部署。</p>
          </template>
          <p v-if="!newProjectUseGithub" class="hint">创建后可在项目详情中手动触发部署，或通过 wrangler 直接上传。</p>

          <div class="section-divider">环境变量（可选）</div>
          <div v-for="(env, i) in newProjectEnvs" :key="`pe-${i}`" class="env-row">
            <input v-model="env.name" placeholder="变量名" class="env-name" />
            <input v-model="env.value" placeholder="值" class="env-val" />
            <select v-model="env.type" class="env-type">
              <option value="plain_text">明文</option>
              <option value="secret_text">机密</option>
            </select>
            <button class="env-del" @click="newProjectEnvs.splice(i, 1)">✕</button>
          </div>
          <button class="add-env-btn" @click="newProjectEnvs.push({ name: '', value: '', type: 'plain_text' })">+ 添加环境变量</button>
        </div>
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
.empty-sm {
  padding: 12px 0;
  text-align: center;
  color: #6b768a;
  font-size: 12px;
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
  flex-wrap: wrap;
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
.code-input {
  font-family: "SF Mono", "Fira Code", monospace !important;
  font-size: 12px !important;
  line-height: 1.5;
  white-space: pre;
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
.binding-section {
  margin-top: 12px;
}
.binding-title {
  font-size: 13px;
  font-weight: 600;
  color: #e8edf5;
  margin-bottom: 6px;
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
  margin-bottom: 12px;
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
.checkbox-row {
  flex-direction: row !important;
  align-items: center;
  gap: 8px !important;
}
.checkbox-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #f69a22;
}
.section-divider {
  margin: 14px 0 4px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  font-weight: 600;
  color: #f69a22;
}
.hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b768a;
  line-height: 1.5;
}
.env-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.env-name {
  flex: 0 0 35%;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 13px;
  outline: none;
  font-family: inherit;
}
.env-val {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 13px;
  outline: none;
  font-family: inherit;
}
.env-type {
  flex: 0 0 auto;
  padding: 8px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 12px;
  outline: none;
  font-family: inherit;
}
.env-type option {
  background: #121a2c;
}
.env-del {
  flex: 0 0 auto;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 93, 77, 0.3);
  background: transparent;
  color: #ff7a6e;
  font-size: 13px;
  cursor: pointer;
}
.add-env-btn {
  margin-top: 4px;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #aab3c5;
  font-size: 12px;
  cursor: pointer;
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
