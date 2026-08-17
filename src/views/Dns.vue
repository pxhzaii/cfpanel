<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  listZones,
  listDnsRecords,
  createDnsRecord,
  updateDnsRecord,
  deleteDnsRecord,
} from "../api/client";
import type { CfZone, CfDnsRecord, DnsRecordForm } from "../api/types";

const zones = ref<CfZone[]>([]);
const currentZone = ref<CfZone | null>(null);
const records = ref<CfDnsRecord[]>([]);
const loading = ref(false);
const error = ref("");
const filter = ref("");
const confirmDel = ref<CfDnsRecord | null>(null);
const showForm = ref(false);
const editing = ref<CfDnsRecord | null>(null);
const form = ref<DnsRecordForm>({
  type: "A",
  name: "",
  content: "",
  ttl: 1,
  proxied: true,
  comment: "",
});

const types = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS", "CAA", "PTR", "HTTPS"];

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return records.value;
  return records.value.filter(
    (r) => r.name.toLowerCase().includes(q) || r.content.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
  );
});

async function loadZones() {
  try {
    zones.value = await listZones();
    if (zones.value.length > 0 && !currentZone.value) {
      currentZone.value = zones.value[0];
      await loadRecords();
    }
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function loadRecords() {
  if (!currentZone.value) return;
  loading.value = true;
  error.value = "";
  try {
    records.value = await listDnsRecords(currentZone.value.id);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function onZoneChange(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  currentZone.value = zones.value.find((z) => z.id === id) ?? null;
  records.value = [];
  loadRecords();
}

function openAdd() {
  editing.value = null;
  form.value = { type: "A", name: "", content: "", ttl: 1, proxied: true, comment: "" };
  showForm.value = true;
}

function openEdit(r: CfDnsRecord) {
  editing.value = r;
  const zoneName = currentZone.value?.name ?? "";
  form.value = {
    type: r.type,
    name: zoneName && r.name.toLowerCase().endsWith("." + zoneName.toLowerCase())
      ? r.name.slice(0, -(zoneName.length + 1))
      : r.name,
    content: r.content,
    ttl: r.ttl === 1 ? 1 : r.ttl,
    proxied: r.proxied,
    comment: r.comment ?? "",
  };
  showForm.value = true;
}

function submitForm() {
  if (!currentZone.value) return;
  const name = form.value.name.endsWith("." + currentZone.value.name)
    ? form.value.name
    : `${form.value.name || "@"}.${currentZone.value.name}`;
  const payload: DnsRecordForm = { ...form.value, name };
  if (editing.value) {
    updateDnsRecord(currentZone.value.id, editing.value.id, payload)
      .then(() => {
        showForm.value = false;
        loadRecords();
      })
      .catch((e) => (error.value = (e as Error).message));
  } else {
    createDnsRecord(currentZone.value.id, payload)
      .then(() => {
        showForm.value = false;
        loadRecords();
      })
      .catch((e) => (error.value = (e as Error).message));
  }
}

function doDelete() {
  if (!currentZone.value || !confirmDel.value) return;
  deleteDnsRecord(currentZone.value.id, confirmDel.value.id)
    .then(() => {
      confirmDel.value = null
      loadRecords()
    })
    .catch((e) => (error.value = (e as Error).message))
}

onMounted(loadZones);
</script>

<template>
  <div class="dns">
    <div class="head">
      <h2>DNS 管理</h2>
      <button class="primary" @click="openAdd">+ 添加记录</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>

    <div class="zone-bar">
      <select :value="currentZone?.id ?? ''" @change="onZoneChange">
        <option value="" disabled>选择域名</option>
        <option v-for="z in zones" :key="z.id" :value="z.id">{{ z.name }}</option>
      </select>
      <input v-model="filter" placeholder="搜索记录…" class="filter" />
    </div>

    <div class="zone-meta" v-if="currentZone">
      <span :class="['status', currentZone.status === 'active' ? 'ok' : 'warn']">
        {{ currentZone.status }}
      </span>
      <span class="ns">{{ currentZone.name_servers?.[0] }}</span>
    </div>

    <div v-if="loading" class="empty">加载中…</div>
    <div v-else-if="filtered.length === 0" class="empty">暂无记录</div>

    <div class="rec-list">
      <div v-for="r in filtered" :key="r.id" class="rec">
        <div class="rec-main">
          <div class="rec-name">
            <span class="type" :class="'t-' + r.type.toLowerCase()">{{ r.type }}</span>
            <span class="nm">{{ r.name }}</span>
            <span v-if="r.proxied" class="proxy">橙云</span>
          </div>
          <div class="rec-content">{{ r.content }}</div>
          <div class="rec-sub">
            TTL {{ r.ttl === 1 ? "自动" : r.ttl + "s" }}
            <template v-if="r.comment"> · {{ r.comment }}</template>
          </div>
        </div>
        <div class="rec-ops">
          <button class="op" @click="openEdit(r)">编辑</button>
          <button class="op danger" @click="confirmDel = r">删除</button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="confirmDel" class="mask">
      <div class="sheet">
        <h3>删除 DNS 记录</h3>
        <p>确定删除 <b>{{ confirmDel.name }}</b>（{{ confirmDel.type }} {{ confirmDel.content }}）？此操作不可恢复。</p>
        <div class="btns">
          <button class="ghost" @click="confirmDel = null">取消</button>
          <button class="danger" @click="doDelete">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 编辑表单 -->
    <div v-if="showForm" class="mask">
      <div class="sheet">
        <h3>{{ editing ? "编辑记录" : "添加记录" }}</h3>
        <div class="fields">
          <label>
            类型
            <select v-model="form.type">
              <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
          <label>
            名称（留空为 @）
            <input v-model="form.name" placeholder="如 www、api" />
          </label>
          <label>
            内容
            <input v-model="form.content" placeholder="如 1.2.3.4 或目标域名" />
          </label>
          <label v-if="form.type === 'MX'">
            优先级
            <input v-model="form.priority" type="number" placeholder="如 10" />
          </label>
          <label>
            TTL
            <select v-model="form.ttl">
              <option :value="1">自动</option>
              <option :value="300">5 分钟</option>
              <option :value="600">10 分钟</option>
              <option :value="1800">30 分钟</option>
              <option :value="3600">1 小时</option>
              <option :value="86400">1 天</option>
            </select>
          </label>
          <label v-if="['A', 'AAAA', 'CNAME'].includes(form.type)">
            代理状态
            <select v-model="form.proxied">
              <option :value="true">橙云代理（加速+隐藏IP）</option>
              <option :value="false">仅 DNS</option>
            </select>
          </label>
          <label>
            备注
            <input v-model="form.comment" placeholder="可选" />
          </label>
        </div>
        <div class="btns">
          <button class="ghost" @click="showForm = false">取消</button>
          <button class="primary" @click="submitForm">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dns {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head h2 {
  margin: 0;
  font-size: 18px;
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
.ghost {
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #aab3c5;
  font-size: 13px;
  cursor: pointer;
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
.err {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 122, 110, 0.12);
  color: #ff7a6e;
  font-size: 13px;
}
.zone {
  display: flex;
  gap: 8px;
}
.zone select,
.filter {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 14px;
  outline: none;
}
.zone select {
  flex: 1;
}
.filter {
  flex: 1;
}
.records-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
  color: #8b95a9;
}
.status.ok {
  color: #9ece6a;
}
.status.warn {
  color: #e0af68;
}
.empty {
  padding: 32px 0;
  text-align: center;
  color: #6b768a;
  font-size: 13px;
}
.rec-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rec {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.rec-main {
  min-width: 0;
  flex: 1;
}
.rec-name {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.type {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 5px;
  color: #0b1220;
}
.t-a {
  background: #7aa2f7;
}
.t-aaaa {
  background: #7aa2f7;
}
.t-cname {
  background: #bb9af7;
}
.t-mx {
  background: #e0af68;
}
.t-txt {
  background: #9ece6a;
}
.t-srv,
.t-srv {
  background: #73daca;
}
.t-ns {
  background: #f7768e;
}
.t-caa,
.t-https,
.t-ptr {
  background: #b4f9f8;
}
.nm {
  font-size: 14px;
  font-weight: 600;
  word-break: break-all;
}
.proxy {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(249, 162, 34, 0.2);
  color: #f69a22;
}
.rec-content {
  font-size: 12px;
  color: #8b95a9;
  word-break: break-all;
  margin-top: 2px;
}
.rec-meta {
  font-size: 11px;
  color: #5d6879;
  margin-top: 2px;
}
.rec-ops {
  display: flex;
  gap: 6px;
}
.op {
  padding: 5px 9px;
  font-size: 12px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #aab3c5;
  cursor: pointer;
}
.op.danger {
  color: #ff7a6e;
  border-color: rgba(255, 122, 110, 0.4);
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
.sheet h3 {
  margin: 0 0 10px;
  font-size: 16px;
}
.sheet p {
  font-size: 13px;
  color: #aab3c5;
  line-height: 1.6;
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
.fields select {
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.25);
  color: #e8edf5;
  font-size: 14px;
  outline: none;
}
.btns {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  justify-content: flex-end;
}
</style>