<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  listKvNamespaces,
  listKvKeys,
  getKvValue,
  putKvValue,
  deleteKvKey,
  listR2Buckets,
  listD1Databases,
  runD1Query,
} from "../api/client";
import type { CfKvNamespace, CfKvKey, CfR2Bucket, CfD1Database, CfD1QueryResult } from "../api/types";

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

// R2
const r2Buckets = ref<CfR2Bucket[]>([]);

// D1
const d1Databases = ref<CfD1Database[]>([]);
const activeDb = ref<CfD1Database | null>(null);
const sql = ref("");
const dbResult = ref<CfD1QueryResult | null>(null);

const loading = ref(false);
const error = ref("");

function closeKvSheet() {
  kvValueKey.value = "";
  kvNewKey.value = "";
  kvNewValue.value = "";
}

/** 当前 KV 编辑中的值（查看 or 新建） */
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
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function removeKvKey(key: string) {
  if (!activeNs.value) return;
  error.value = "";
  try {
    await deleteKvKey(activeNs.value.id, key);
    if (kvValueKey.value === key) {
      kvValueKey.value = "";
      kvValue.value = "";
    }
    loadKvKeys();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

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

function openDb(db: CfD1Database) {
  activeDb.value = db;
  sql.value = "";
  dbResult.value = null;
}

function backDb() {
  activeDb.value = null;
  dbResult.value = null;
  sql.value = "";
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
            <div class="item-arrow">›</div>
          </div>
        </div>
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

        <!-- 新增 key 快捷入口 -->
        <button class="add-btn" @click="openNewKv">
          + 新建 Key
        </button>
      </div>
    </template>

    <!-- R2 -->
    <template v-else-if="tab === 'r2'">
      <div v-if="loading" class="empty">加载中…</div>
      <div v-else-if="r2Buckets.length === 0" class="empty">暂无 R2 存储桶</div>
      <div class="list">
        <div v-for="b in r2Buckets" :key="b.id" class="item">
          <div class="item-main">
            <div class="item-title">{{ b.name }}</div>
            <div class="item-sub">
              创建于 {{ new Date(b.creation_date).toLocaleDateString() }}
              <template v-if="b.location"> · {{ b.location }}</template>
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
            </div>
            <div class="item-arrow">›</div>
          </div>
        </div>
      </div>

      <div v-else>
        <div class="kv-head">
          <button class="back" @click="backDb">‹ 返回</button>
          <span class="ns-title">{{ activeDb.name }}</span>
        </div>
        <textarea v-model="sql" rows="4" placeholder="输入 SQL，如：SELECT * FROM users LIMIT 10" class="sql"></textarea>
        <button class="primary run" @click="runSql" :disabled="loading">
          {{ loading ? "执行中…" : "执行 SQL" }}
        </button>
        <div v-if="dbResult" class="db-result">
          <div class="db-meta" v-if="dbResult.meta">
            rows_read: {{ dbResult.meta.rows_read }} · rows_written: {{ dbResult.meta.rows_written }} ·
            耗时 {{ dbResult.meta.duration }}ms
          </div>
          <pre>{{ JSON.stringify(dbResult.results ?? [], null, 2) }}</pre>
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
.fields textarea {
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