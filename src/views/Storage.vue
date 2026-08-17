<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  listKvNamespaces,
  createKvNamespace,
  deleteKvNamespace,
  listKvKeys,
  getKvValue,
  putKvValue,
  deleteKvKey,
  listR2Buckets,
  createR2Bucket,
  deleteR2Bucket,
  getR2Bucket,
  listR2Objects,
  putR2Object,
  getR2Object,
  deleteR2Object,
  emptyR2Bucket,
  getR2Cors,
  setR2Cors,
  listR2CustomDomains,
  addR2CustomDomain,
  deleteR2CustomDomain,
  listD1Databases,
  createD1Database,
  deleteD1Database,
  runD1Query,
} from "../api/client";
import type {
  CfKvNamespace,
  CfKvKey,
  CfR2Bucket,
  CfR2Object,
  CfR2CorsConfig,
  CfR2CustomDomain,
  CfD1Database,
  CfD1QueryResult,
} from "../api/types";

const tab = ref<"kv" | "r2" | "d1">("kv");

// KV
const kvNamespaces = ref<CfKvNamespace[]>([]);
const kvKeys = ref<CfKvKey[]>([]);
const kvPrefix = ref("");
const activeNs = ref<CfKvNamespace | null>(null);
const kvValue = ref("");
const kvValueKey = ref("");
const kvNewKey = ref("");
const kvNewValue = ref("");
const showCreateKv = ref(false);
const newKvTitle = ref("");

// R2
const r2Buckets = ref<CfR2Bucket[]>([]);
const showCreateR2 = ref(false);
const newR2Name = ref("");
const newR2Location = ref("");
// R2 详情
const activeR2Bucket = ref<CfR2Bucket | null>(null);
const r2Objects = ref<CfR2Object[]>([]);
const r2Detail = ref<{ location?: string; storage_class?: string } | null>(null);
const r2Cors = ref<CfR2CorsConfig | null>(null);
const r2CustomDomains = ref<CfR2CustomDomain[]>([]);
const r2SubTab = ref<"files" | "cors" | "domains" | "settings">("files");
// R2 文件操作
const r2ObjectContent = ref("");
const r2ObjectKey = ref("");
const r2ObjectContentType = ref("");
const r2ObjectIsText = ref(false);
const showUploadR2 = ref(false);
const uploadKey = ref("");
const uploadText = ref("");
const uploadContentType = ref("");
const confirmR2Delete = ref<string | null>(null);
const emptying = ref(false);
const emptyResult = ref<string | null>(null);
// R2 CORS 编辑
const showCorsEditor = ref(false);
const corsOrigins = ref("");
const corsMethods = ref("");
const corsHeaders = ref("*");
const corsMaxAge = ref(3600);
// R2 自定义域
const showAddDomain = ref(false);
const newDomainName = ref("");
const newDomainZoneId = ref("");

// D1
const d1Databases = ref<CfD1Database[]>([]);
const activeDb = ref<CfD1Database | null>(null);
const sql = ref("");
const dbResult = ref<CfD1QueryResult | null>(null);
const showCreateD1 = ref(false);
const newD1Name = ref("");
const dbTables = ref<string[]>([]);

const loading = ref(false);
const error = ref("");
const confirmDelete = ref<string | null>(null);

function closeKvSheet() {
  kvValueKey.value = "";
  kvNewKey.value = "";
  kvNewValue.value = "";
}

const kvEditValue = computed({
  get: () => (kvValueKey.value ? kvValue.value : kvNewValue.value),
  set: (v: string) => {
    if (kvValueKey.value) kvValue.value = v;
    else kvNewValue.value = v;
  },
});

function openNewKv() {
  kvValueKey.value = "";
  kvNewKey.value = "";
  kvNewValue.value = "";
}

async function loadKvNamespaces() {
  loading.value = true;
  error.value = "";
  try {
    kvNamespaces.value = await listKvNamespaces();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function createKv() {
  if (!newKvTitle.value.trim()) {
    error.value = "请输入命名空间名称";
    return;
  }
  error.value = "";
  try {
    await createKvNamespace(newKvTitle.value.trim());
    newKvTitle.value = "";
    showCreateKv.value = false;
    await loadKvNamespaces();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeKvNamespace(ns: CfKvNamespace) {
  error.value = "";
  try {
    await deleteKvNamespace(ns.id);
    confirmDelete.value = null;
    if (activeNs.value?.id === ns.id) activeNs.value = null;
    await loadKvNamespaces();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function openNamespace(ns: CfKvNamespace) {
  activeNs.value = ns;
  kvKeys.value = [];
  kvPrefix.value = "";
  loadKvKeys();
}

async function loadKvKeys() {
  if (!activeNs.value) return;
  loading.value = true;
  error.value = "";
  try {
    kvKeys.value = await listKvKeys(activeNs.value.id, kvPrefix.value.trim() || undefined);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function openKvValue(key: string) {
  if (!activeNs.value) return;
  kvValueKey.value = key;
  kvValue.value = "加载中…";
  try {
    kvValue.value = await getKvValue(activeNs.value.id, key);
  } catch (e) {
    kvValue.value = (e as Error).message;
  }
}

async function saveKv() {
  if (!activeNs.value) return;
  error.value = "";
  try {
    if (kvValueKey.value) {
      await putKvValue(activeNs.value.id, kvValueKey.value, kvValue.value);
    } else {
      if (!kvNewKey.value.trim()) {
        error.value = "请输入 Key 名称";
        return;
      }
      await putKvValue(activeNs.value.id, kvNewKey.value.trim(), kvNewValue.value);
    }
    loadKvKeys();
    closeKvSheet();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeKvKey(key: string) {
  if (!activeNs.value) return;
  error.value = "";
  try {
    await deleteKvKey(activeNs.value.id, key);
    if (kvValueKey.value === key) closeKvSheet();
    loadKvKeys();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

// R2
async function loadR2() {
  loading.value = true;
  error.value = "";
  try {
    r2Buckets.value = await listR2Buckets();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function createR2() {
  if (!newR2Name.value.trim()) {
    error.value = "请输入存储桶名称";
    return;
  }
  error.value = "";
  try {
    await createR2Bucket(newR2Name.value.trim(), newR2Location.value || undefined);
    newR2Name.value = "";
    newR2Location.value = "";
    showCreateR2.value = false;
    await loadR2();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeR2Bucket(b: CfR2Bucket) {
  error.value = "";
  try {
    await deleteR2Bucket(b.name);
    confirmDelete.value = null;
    await loadR2();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

// R2 详情
async function openR2Bucket(b: CfR2Bucket) {
  activeR2Bucket.value = b;
  r2SubTab.value = "files";
  r2Objects.value = [];
  r2Detail.value = null;
  r2Cors.value = null;
  r2CustomDomains.value = [];
  loadR2Objects();
}

function backR2() {
  activeR2Bucket.value = null;
  r2Objects.value = [];
  r2Detail.value = null;
  r2Cors.value = null;
  r2CustomDomains.value = [];
  r2ObjectKey.value = "";
  r2ObjectContent.value = "";
}

async function loadR2Objects() {
  if (!activeR2Bucket.value) return;
  loading.value = true;
  error.value = "";
  try {
    const page = await listR2Objects(activeR2Bucket.value.name);
    r2Objects.value = page.result;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadR2Detail() {
  if (!activeR2Bucket.value) return;
  try {
    r2Detail.value = await getR2Bucket(activeR2Bucket.value.name);
  } catch { /* 静默 */ }
}

async function loadR2Cors() {
  if (!activeR2Bucket.value) return;
  try {
    r2Cors.value = await getR2Cors(activeR2Bucket.value.name);
  } catch { /* 静默 */ }
}

async function loadR2Domains() {
  if (!activeR2Bucket.value) return;
  try {
    r2CustomDomains.value = await listR2CustomDomains(activeR2Bucket.value.name);
  } catch { /* 静默 */ }
}

function switchR2SubTab(t: "files" | "cors" | "domains" | "settings") {
  r2SubTab.value = t;
  if (t === "cors" && !r2Cors.value) loadR2Cors();
  if (t === "domains" && r2CustomDomains.value.length === 0) loadR2Domains();
  if (t === "settings" && !r2Detail.value) loadR2Detail();
}

async function viewR2Object(key: string) {
  if (!activeR2Bucket.value) return;
  r2ObjectKey.value = key;
  r2ObjectContent.value = "加载中…";
  r2ObjectIsText.value = false;
  try {
    const data = await getR2Object(activeR2Bucket.value.name, key);
    r2ObjectContentType.value = data.contentType || "";
    // 判断是否是文本/图片
    const ct = data.contentType || "";
    if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml") || ct.includes("javascript")) {
      // base64 解码
      try {
        const decoded = atob(data.body);
        r2ObjectContent.value = decoded;
        r2ObjectIsText.value = true;
      } catch {
        r2ObjectContent.value = `(无法解码，base64: ${data.body.slice(0, 200)}...)`;
      }
    } else if (ct.startsWith("image/")) {
      r2ObjectContent.value = `data:${ct};base64,${data.body}`;
      r2ObjectIsText.value = false;
    } else {
      r2ObjectContent.value = `(二进制内容，base64 长度: ${data.body.length})`;
      r2ObjectIsText.value = false;
    }
  } catch (e) {
    r2ObjectContent.value = (e as Error).message;
  }
}

async function deleteR2ObjectConfirm(key: string) {
  if (!activeR2Bucket.value) return;
  error.value = "";
  try {
    await deleteR2Object(activeR2Bucket.value.name, key);
    confirmR2Delete.value = null;
    if (r2ObjectKey.value === key) {
      r2ObjectKey.value = "";
      r2ObjectContent.value = "";
    }
    await loadR2Objects();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function uploadR2Object() {
  if (!activeR2Bucket.value || !uploadKey.value.trim()) {
    error.value = "请输入文件名";
    return;
  }
  error.value = "";
  try {
    // 将文本转为 base64
    const encoder = new TextEncoder();
    const bytes = encoder.encode(uploadText.value);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    await putR2Object(
      activeR2Bucket.value.name,
      uploadKey.value.trim(),
      base64,
      uploadContentType.value || "text/plain"
    );
    uploadKey.value = "";
    uploadText.value = "";
    uploadContentType.value = "";
    showUploadR2.value = false;
    await loadR2Objects();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function emptyBucket() {
  if (!activeR2Bucket.value) return;
  emptying.value = true;
  emptyResult.value = null;
  error.value = "";
  try {
    const result = await emptyR2Bucket(activeR2Bucket.value.name);
    emptyResult.value = `已删除 ${result.deleted} 个对象` + (result.errors.length > 0 ? `，${result.errors.length} 个失败` : "");
    confirmR2Delete.value = null;
    await loadR2Objects();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    emptying.value = false;
  }
}

async function saveCors() {
  if (!activeR2Bucket.value) return;
  error.value = "";
  try {
    const origins = corsOrigins.value.split("\n").map((s) => s.trim()).filter(Boolean);
    const methods = corsMethods.value.split(",").map((s) => s.trim()).filter(Boolean);
    const headers = corsHeaders.value.split(",").map((s) => s.trim()).filter(Boolean);
    const rules = [{ allowed: { origins, methods, headers }, exposeHeaders: ["ETag"], maxAgeSeconds: Number(corsMaxAge.value) || 3600 }];
    await setR2Cors(activeR2Bucket.value.name, rules);
    showCorsEditor.value = false;
    await loadR2Cors();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function openCorsEditor() {
  const rules = r2Cors.value?.rules;
  if (rules && rules[0]) {
    corsOrigins.value = rules[0].allowed.origins.join("\n");
    corsMethods.value = rules[0].allowed.methods.join(", ");
    corsHeaders.value = rules[0].allowed.headers.join(", ");
    corsMaxAge.value = rules[0].maxAgeSeconds ?? 3600;
  } else {
    corsOrigins.value = "*";
    corsMethods.value = "GET, HEAD";
    corsHeaders.value = "*";
    corsMaxAge.value = 3600;
  }
  showCorsEditor.value = true;
}

async function addCustomDomain() {
  if (!activeR2Bucket.value || !newDomainName.value.trim() || !newDomainZoneId.value.trim()) {
    error.value = "请填写域名和 Zone ID";
    return;
  }
  error.value = "";
  try {
    await addR2CustomDomain(activeR2Bucket.value.name, newDomainName.value.trim(), newDomainZoneId.value.trim());
    newDomainName.value = "";
    newDomainZoneId.value = "";
    showAddDomain.value = false;
    await loadR2Domains();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeCustomDomain(domain: string) {
  if (!activeR2Bucket.value) return;
  error.value = "";
  try {
    await deleteR2CustomDomain(activeR2Bucket.value.name, domain);
    confirmR2Delete.value = null;
    await loadR2Domains();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

// D1
async function loadD1() {
  loading.value = true;
  error.value = "";
  try {
    d1Databases.value = await listD1Databases();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function createD1() {
  if (!newD1Name.value.trim()) {
    error.value = "请输入数据库名称";
    return;
  }
  error.value = "";
  try {
    await createD1Database(newD1Name.value.trim());
    newD1Name.value = "";
    showCreateD1.value = false;
    await loadD1();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeD1Database(db: CfD1Database) {
  error.value = "";
  try {
    await deleteD1Database(db.uuid);
    confirmDelete.value = null;
    await loadD1();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function runSql() {
  if (!activeDb.value || !sql.value.trim()) return;
  dbResult.value = null;
  loading.value = true;
  error.value = "";
  try {
    dbResult.value = await runD1Query(activeDb.value.uuid, sql.value.trim());
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadDbTables() {
  if (!activeDb.value) return;
  try {
    const result = await runD1Query(activeDb.value.uuid, "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    dbTables.value = (result?.[0]?.results ?? []).map((r) => String(r.name));
  } catch {
    dbTables.value = [];
  }
}

function openDb(db: CfD1Database) {
  activeDb.value = db;
  sql.value = "";
  dbResult.value = null;
  dbTables.value = [];
  loadDbTables();
}

function backDb() {
  activeDb.value = null;
  dbResult.value = null;
  sql.value = "";
  dbTables.value = [];
}

function switchTab(t: "kv" | "r2" | "d1") {
  tab.value = t;
  error.value = "";
  if (t === "r2" && r2Buckets.value.length === 0) loadR2();
  if (t === "d1" && d1Databases.value.length === 0) loadD1();
}

onMounted(() => {
  loadKvNamespaces();
});
</script>

<template>
  <div class="store">
    <div class="head">
      <h2>存储</h2>
      <div class="tabs">
        <button :class="{ active: tab === 'kv' }" @click="tab = 'kv'">KV</button>
        <button :class="{ active: tab === 'r2' }" @click="switchTab('r2')">R2</button>
        <button :class="{ active: tab === 'd1' }" @click="switchTab('d1')">D1</button>
      </div>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <!-- KV -->
    <template v-if="tab === 'kv'">
      <div v-if="!activeNs">
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="kvNamespaces.length === 0" class="empty">暂无 KV 命名空间</div>
        <div class="list">
          <div v-for="ns in kvNamespaces" :key="ns.id" class="item" @click="openNamespace(ns)">
            <div class="item-main">
              <div class="item-title">{{ ns.title }}</div>
              <div class="item-sub">{{ ns.id }}</div>
            </div>
            <button class="del-btn" @click.stop="confirmDelete = ns.id" v-if="confirmDelete !== ns.id">删除</button>
            <div v-else class="confirm-box">
              <button class="danger sm" @click.stop="removeKvNamespace(ns)">确认</button>
              <button class="sm" @click.stop="confirmDelete = null">取消</button>
            </div>
          </div>
        </div>
        <button class="add-btn" @click="showCreateKv = true">+ 新建命名空间</button>
      </div>

      <div v-else>
        <div class="kv-head">
          <button class="back" @click="activeNs = null; kvKeys = []">‹ 返回</button>
          <span class="ns-title">{{ activeNs.title }}</span>
        </div>
        <div class="kv-bar">
          <input v-model="kvPrefix" placeholder="前缀过滤…" @keyup.enter="loadKvKeys" />
          <button class="primary" @click="loadKvKeys">查询</button>
        </div>

        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="kvKeys.length === 0" class="empty">暂无 Key</div>
        <div class="list">
          <div v-for="k in kvKeys" :key="k.name" class="item" @click="openKvValue(k.name)">
            <div class="item-main">
              <div class="item-title">{{ k.name }}</div>
              <div class="item-sub">
                {{ k.expiration ? "过期：" + new Date(k.expiration * 1000).toLocaleString() : "永久" }}
              </div>
            </div>
            <div class="item-arrow">›</div>
          </div>
        </div>

        <button class="add-btn" @click="openNewKv">+ 新建 Key</button>
      </div>
    </template>

    <!-- R2 -->
    <template v-else-if="tab === 'r2'">
      <!-- 存储桶列表 -->
      <div v-if="!activeR2Bucket">
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="r2Buckets.length === 0" class="empty">暂无 R2 存储桶</div>
        <div class="list">
          <div v-for="b in r2Buckets" :key="b.id" class="item" @click="openR2Bucket(b)">
            <div class="item-main">
              <div class="item-title">{{ b.name }}</div>
              <div class="item-sub">
                创建于 {{ new Date(b.creation_date).toLocaleDateString() }}
                <template v-if="b.location"> · {{ b.location }}</template>
              </div>
            </div>
            <div class="item-side">
              <button class="del-btn" @click.stop="confirmDelete = `r2:${b.name}`" v-if="confirmDelete !== `r2:${b.name}`">删除</button>
              <div v-else class="confirm-box">
                <button class="danger sm" @click.stop="removeR2Bucket(b)">确认</button>
                <button class="sm" @click.stop="confirmDelete = null">取消</button>
              </div>
              <div class="item-arrow">›</div>
            </div>
          </div>
        </div>
        <button class="add-btn" @click="showCreateR2 = true">+ 新建存储桶</button>
      </div>

      <!-- 存储桶详情 -->
      <div v-else class="detail">
        <div class="kv-head">
          <button class="back" @click="backR2">‹ 返回</button>
          <span class="ns-title">{{ activeR2Bucket.name }}</span>
        </div>
        <div class="sub-tabs">
          <button :class="{ active: r2SubTab === 'files' }" @click="switchR2SubTab('files')">文件</button>
          <button :class="{ active: r2SubTab === 'cors' }" @click="switchR2SubTab('cors')">CORS</button>
          <button :class="{ active: r2SubTab === 'domains' }" @click="switchR2SubTab('domains')">自定义域</button>
          <button :class="{ active: r2SubTab === 'settings' }" @click="switchR2SubTab('settings')">设置</button>
        </div>

        <!-- 文件列表 -->
        <div v-if="r2SubTab === 'files'">
          <div v-if="!r2ObjectKey">
            <div v-if="loading" class="empty">加载中…</div>
            <div v-else-if="r2Objects.length === 0" class="empty">暂无文件</div>
            <div class="list">
              <div v-for="obj in r2Objects" :key="obj.key" class="item" @click="viewR2Object(obj.key)">
                <div class="item-main">
                  <div class="item-title">{{ obj.key }}</div>
                  <div class="item-sub">{{ formatSize(obj.size) }} · {{ obj.http_metadata?.contentType || "未知类型" }} · {{ new Date(obj.last_modified).toLocaleDateString() }}</div>
                </div>
                <div class="item-side">
                  <button class="del-btn" @click.stop="confirmR2Delete = obj.key" v-if="confirmR2Delete !== obj.key">删除</button>
                  <div v-else class="confirm-box">
                    <button class="danger sm" @click.stop="deleteR2ObjectConfirm(obj.key)">确认</button>
                    <button class="sm" @click.stop="confirmR2Delete = null">取消</button>
                  </div>
                  <div class="item-arrow">›</div>
                </div>
              </div>
            </div>
            <button class="add-btn" @click="showUploadR2 = true">+ 上传文件</button>
          </div>

          <!-- 文件内容查看 -->
          <div v-else>
            <div class="kv-head">
              <button class="back" @click="r2ObjectKey = ''; r2ObjectContent = ''">‹ 返回</button>
              <span class="ns-title">{{ r2ObjectKey }}</span>
            </div>
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">类型</span>
                <span class="info-val">{{ r2ObjectContentType || "未知" }}</span>
              </div>
            </div>
            <img v-if="r2ObjectContent.startsWith('data:image/')" :src="r2ObjectContent" class="r2-image" />
            <pre v-else class="code">{{ r2ObjectContent }}</pre>
            <button class="danger run" @click="deleteR2ObjectConfirm(r2ObjectKey); r2ObjectKey = ''; r2ObjectContent = ''">删除此文件</button>
          </div>
        </div>

        <!-- CORS 策略 -->
        <div v-if="r2SubTab === 'cors'">
          <div v-if="r2Cors && r2Cors.rules && r2Cors.rules.length > 0">
            <div v-for="(rule, i) in r2Cors.rules" :key="i" class="info-box">
              <div class="info-row">
                <span class="info-label">允许来源</span>
                <span class="info-val" v-for="o in rule.allowed.origins" :key="o">{{ o }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">允许方法</span>
                <span class="info-val">{{ rule.allowed.methods.join(", ") }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">允许头</span>
                <span class="info-val">{{ rule.allowed.headers.join(", ") }}</span>
              </div>
              <div class="info-row" v-if="rule.maxAgeSeconds">
                <span class="info-label">缓存时间</span>
                <span class="info-val">{{ rule.maxAgeSeconds }}秒</span>
              </div>
            </div>
            <button class="primary run" @click="openCorsEditor">编辑 CORS</button>
          </div>
          <div v-else>
            <div class="empty">暂无 CORS 策略</div>
            <button class="primary run" @click="openCorsEditor">+ 添加 CORS 策略</button>
          </div>
        </div>

        <!-- 自定义域 -->
        <div v-if="r2SubTab === 'domains'">
          <div v-if="r2CustomDomains.length === 0" class="empty">暂无自定义域</div>
          <div class="list">
            <div v-for="d in r2CustomDomains" :key="d.domain" class="item">
              <div class="item-main">
                <div class="item-title">{{ d.domain }}</div>
                <div class="item-sub">{{ d.zoneName }} · SSL: {{ d.status.ssl }} · TLS {{ d.minTLS }}</div>
              </div>
              <button class="del-btn" @click="confirmR2Delete = `domain:${d.domain}`" v-if="confirmR2Delete !== `domain:${d.domain}`">删除</button>
              <div v-else class="confirm-box">
                <button class="danger sm" @click="removeCustomDomain(d.domain)">确认</button>
                <button class="sm" @click="confirmR2Delete = null">取消</button>
              </div>
            </div>
          </div>
          <button class="add-btn" @click="showAddDomain = true">+ 添加自定义域</button>
        </div>

        <!-- 设置 -->
        <div v-if="r2SubTab === 'settings'">
          <div class="info-box">
            <div class="info-row">
              <span class="info-label">名称</span>
              <span class="info-val">{{ activeR2Bucket.name }}</span>
            </div>
            <div class="info-row" v-if="r2Detail">
              <span class="info-label">位置</span>
              <span class="info-val">{{ r2Detail.location || "默认" }}</span>
            </div>
            <div class="info-row" v-if="r2Detail">
              <span class="info-label">存储类</span>
              <span class="info-val">{{ r2Detail.storage_class || "Standard" }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">创建时间</span>
              <span class="info-val">{{ new Date(activeR2Bucket.creation_date).toLocaleString() }}</span>
            </div>
          </div>

          <p v-if="emptyResult" class="ok-msg">{{ emptyResult }}</p>

          <button class="warn-btn run" @click="confirmR2Delete = 'empty'" :disabled="emptying" v-if="confirmR2Delete !== 'empty'">
            {{ emptying ? "清空中…" : "清空存储桶" }}
          </button>
          <div v-else class="confirm-bar">
            <span class="warn-text">确定清空所有文件？此操作不可恢复！</span>
            <div class="confirm-box">
              <button class="danger sm" @click="emptyBucket" :disabled="emptying">{{ emptying ? "清空中…" : "确认清空" }}</button>
              <button class="sm" @click="confirmR2Delete = null">取消</button>
            </div>
          </div>

          <button class="danger run" @click="confirmR2Delete = 'delete'" v-if="confirmR2Delete !== 'delete'">删除存储桶</button>
          <div v-else class="confirm-bar">
            <span class="warn-text">确定删除整个存储桶？</span>
            <div class="confirm-box">
              <button class="danger sm" @click="removeR2Bucket(activeR2Bucket); backR2()">确认删除</button>
              <button class="sm" @click="confirmR2Delete = null">取消</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- D1 -->
    <template v-else>
      <div v-if="!activeDb">
        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="d1Databases.length === 0" class="empty">暂无 D1 数据库</div>
        <div class="list">
          <div v-for="db in d1Databases" :key="db.uuid" class="item" @click="openDb(db)">
            <div class="item-main">
              <div class="item-title">{{ db.name }}</div>
              <div class="item-sub">{{ db.uuid }}</div>
              <div class="item-sub" v-if="db.num_tables !== undefined">{{ db.num_tables }} 张表 · {{ Math.round((db.file_size ?? 0) / 1024) }}KB</div>
            </div>
            <div class="item-side">
              <button class="del-btn" @click.stop="confirmDelete = `d1:${db.uuid}`" v-if="confirmDelete !== `d1:${db.uuid}`">删除</button>
              <div v-else class="confirm-box">
                <button class="danger sm" @click.stop="removeD1Database(db)">确认</button>
                <button class="sm" @click.stop="confirmDelete = null">取消</button>
              </div>
            </div>
          </div>
        </div>
        <button class="add-btn" @click="showCreateD1 = true">+ 新建数据库</button>
      </div>

      <div v-else>
        <div class="kv-head">
          <button class="back" @click="backDb">‹ 返回</button>
          <span class="ns-title">{{ activeDb.name }}</span>
        </div>

        <!-- 表列表 -->
        <div v-if="dbTables.length > 0" class="tables-box">
          <div class="tables-title">表（{{ dbTables.length }}）</div>
          <div class="tables-list">
            <span v-for="t in dbTables" :key="t" class="table-tag" @click="sql = `SELECT * FROM ${t} LIMIT 50`">{{ t }}</span>
          </div>
        </div>

        <textarea v-model="sql" rows="4" placeholder="输入 SQL，如：SELECT * FROM users LIMIT 10" class="sql"></textarea>
        <button class="primary run" @click="runSql" :disabled="loading">
          {{ loading ? "执行中…" : "执行 SQL" }}
        </button>
        <div v-if="dbResult" class="db-result">
          <div class="db-meta" v-if="dbResult[0]?.meta">
            rows_read: {{ dbResult[0].meta.rows_read }} · rows_written: {{ dbResult[0].meta.rows_written }} ·
            耗时 {{ dbResult[0].meta.duration.toFixed(1) }}ms
          </div>
          <pre>{{ JSON.stringify(dbResult[0]?.results ?? [], null, 2) }}</pre>
        </div>
      </div>
    </template>

    <!-- KV 值弹层 -->
    <div v-if="activeNs && kvValueKey !== undefined && (kvValueKey !== '' || kvNewKey !== '')" class="mask">
      <div class="sheet">
        <div class="sheet-head">
          <h3>{{ kvValueKey || "新建 Key" }}</h3>
          <button class="close" @click="closeKvSheet">关闭</button>
        </div>
        <div class="fields">
          <label v-if="!kvValueKey">
            Key 名称
            <input v-model="kvNewKey" placeholder="key 名" />
          </label>
          <label>
            Value
            <textarea v-model="kvEditValue" rows="6" placeholder="值内容"></textarea>
          </label>
        </div>
        <div class="btns">
          <button v-if="kvValueKey" class="danger" @click="removeKvKey(kvValueKey)">删除</button>
          <button class="primary" @click="saveKv">保存</button>
        </div>
      </div>
    </div>

    <!-- 创建 KV 命名空间弹层 -->
    <div v-if="showCreateKv" class="mask" @click.self="showCreateKv = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>新建 KV 命名空间</h3>
          <button class="close" @click="showCreateKv = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            名称
            <input v-model="newKvTitle" placeholder="如：my-kv-namespace" @keyup.enter="createKv" />
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="createKv">创建</button>
        </div>
      </div>
    </div>

    <!-- 创建 R2 存储桶弹层 -->
    <div v-if="showCreateR2" class="mask" @click.self="showCreateR2 = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>新建 R2 存储桶</h3>
          <button class="close" @click="showCreateR2 = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            名称
            <input v-model="newR2Name" placeholder="如：my-bucket" @keyup.enter="createR2" />
          </label>
          <label>
            位置（可选）
            <select v-model="newR2Location">
              <option value="">默认</option>
              <option value="APAC">亚太</option>
              <option value="WNAM">北美西部</option>
              <option value="ENAM">北美东部</option>
              <option value="EEUR">欧洲东部</option>
              <option value="WEUR">欧洲西部</option>
            </select>
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="createR2">创建</button>
        </div>
      </div>
    </div>

    <!-- 创建 D1 数据库弹层 -->
    <div v-if="showCreateD1" class="mask" @click.self="showCreateD1 = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>新建 D1 数据库</h3>
          <button class="close" @click="showCreateD1 = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            名称
            <input v-model="newD1Name" placeholder="如：my-database" @keyup.enter="createD1" />
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="createD1">创建</button>
        </div>
      </div>
    </div>

    <!-- R2 上传文件弹层 -->
    <div v-if="showUploadR2" class="mask" @click.self="showUploadR2 = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>上传文件</h3>
          <button class="close" @click="showUploadR2 = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            文件名
            <input v-model="uploadKey" placeholder="如：test.txt" @keyup.enter="uploadR2Object" />
          </label>
          <label>
            内容类型
            <input v-model="uploadContentType" placeholder="如：text/plain（可选）" />
          </label>
          <label>
            内容（文本）
            <textarea v-model="uploadText" rows="6" placeholder="输入文本内容"></textarea>
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="uploadR2Object">上传</button>
        </div>
      </div>
    </div>

    <!-- R2 CORS 编辑弹层 -->
    <div v-if="showCorsEditor" class="mask" @click.self="showCorsEditor = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>CORS 策略</h3>
          <button class="close" @click="showCorsEditor = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            允许来源（每行一个）
            <textarea v-model="corsOrigins" rows="4" placeholder="*&#10;https://example.com"></textarea>
          </label>
          <label>
            允许方法（逗号分隔）
            <input v-model="corsMethods" placeholder="GET, HEAD, PUT, POST, DELETE" />
          </label>
          <label>
            允许头（逗号分隔）
            <input v-model="corsHeaders" placeholder="*" />
          </label>
          <label>
            缓存时间（秒）
            <input v-model="corsMaxAge" type="number" placeholder="3600" />
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="saveCors">保存</button>
        </div>
      </div>
    </div>

    <!-- R2 添加自定义域弹层 -->
    <div v-if="showAddDomain" class="mask" @click.self="showAddDomain = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>添加自定义域</h3>
          <button class="close" @click="showAddDomain = false">关闭</button>
        </div>
        <div class="fields">
          <label>
            域名
            <input v-model="newDomainName" placeholder="如：cdn.example.com" @keyup.enter="addCustomDomain" />
          </label>
          <label>
            Zone ID
            <input v-model="newDomainZoneId" placeholder="Cloudflare Zone ID" />
          </label>
        </div>
        <div class="btns">
          <button class="primary" @click="addCustomDomain">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.store {
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
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
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
.kv-bar {
  display: flex;
  gap: 8px;
}
.kv-bar input {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 14px;
  outline: none;
}
.primary {
  padding: 9px 14px;
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
.sql {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
}
.run {
  margin-top: 8px;
  width: 100%;
}
.tables-box {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.tables-title {
  font-size: 12px;
  color: #8b95a9;
  margin-bottom: 8px;
}
.tables-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.table-tag {
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(249, 162, 34, 0.1);
  color: #f69a22;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid rgba(249, 162, 34, 0.2);
}
.table-tag:hover {
  background: rgba(249, 162, 34, 0.2);
}
.db-result {
  margin-top: 10px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.db-meta {
  font-size: 12px;
  color: #8b95a9;
  margin-bottom: 8px;
}
.db-result pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: #c8d3e8;
  max-height: 40vh;
  overflow-y: auto;
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
  word-break: break-all;
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
.detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.code {
  font-size: 12px;
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
  margin: 0;
}
.r2-image {
  width: 100%;
  border-radius: 10px;
  margin: 8px 0;
}
.warn-btn {
  padding: 9px 14px;
  border: 1px solid rgba(255, 200, 50, 0.4);
  border-radius: 10px;
  background: rgba(255, 200, 50, 0.08);
  color: #ffc832;
  font-size: 13px;
  cursor: pointer;
}
.warn-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.confirm-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 12px;
  background: rgba(255, 200, 50, 0.08);
  border: 1px solid rgba(255, 200, 50, 0.3);
}
.warn-text {
  font-size: 13px;
  color: #ffc832;
}
.ok-msg {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(80, 220, 120, 0.12);
  color: #50dc78;
  font-size: 13px;
}
.item-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
</style>
