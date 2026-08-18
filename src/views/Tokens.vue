<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import {
  listApiTokens,
  createApiToken,
  deleteApiToken,
  rotateApiTokenValue,
  listTokenPermissionGroups,
} from "../api/client";
import type {
  CfApiToken,
  CfTokenPermissionGroup,
} from "../api/types";

const tokens = ref<CfApiToken[]>([]);
const permissionGroups = ref<CfTokenPermissionGroup[]>([]);
const loading = ref(false);
const error = ref("");

// 创建 Token 弹窗
const showCreate = ref(false);
const newName = ref("");
const selectedPermIds = ref<string[]>([]);
const expiresInDays = ref<number>(0); // 0 = 永不过期
const creating = ref(false);
const createdTokenValue = ref<string | null>(null);
const copiedToClipboard = ref(false);

// 权限过滤分类
type PermFilter = "" | "dns" | "workers" | "database" | "custom";
const permFilter = ref<PermFilter>("");

// 各分类的关键词匹配规则
const FILTER_KEYWORDS: Record<Exclude<PermFilter, "">, string[]> = {
  dns: ["dns"],
  workers: ["worker", "pages", "script", "kv", "r2", "storage"],
  database: ["d1", "database", "sql"],
  custom: [], // 全部
};

function setPermFilter(f: PermFilter) {
  if (permFilter.value === f) {
    // 再次点击同一个则取消
    permFilter.value = "";
  } else {
    permFilter.value = f;
  }
}

function matchesFilter(pg: CfTokenPermissionGroup, f: PermFilter): boolean {
  if (!f || f === "custom") return true;
  const name = pg.name.toLowerCase();
  const keywords = FILTER_KEYWORDS[f] ?? [];
  return keywords.some((kw) => name.includes(kw));
}

// 删除确认
const confirmDeleteId = ref<string | null>(null);

// 轮换确认
const confirmRotateId = ref<string | null>(null);
const rotatedValue = ref<string | null>(null);

// 预设模板（已移除快速模板，只保留自定义）

// ---- 权限解析与分组 ----

/** 已知操作后缀（按优先级排序，长的先匹配） */
const KNOWN_OPS = [
  "Metadata Read", "Metadata Write",
  "Run Engine", "Send",
  "Read", "Write", "Run", "Edit", "Revoke", "Admin", "Bind", "Purge",
  "Report", "Telemetry Write", "Action", "Preview", "Trace", "Raw",
];

interface ParsedPerm {
  pg: CfTokenPermissionGroup;
  service: string;
  op: string;       // 操作名，如 "Read"、"Write"、"Run"、"Report"
  level: "read" | "write" | "other";
}

function parsePerm(pg: CfTokenPermissionGroup): ParsedPerm {
  const name = pg.name;
  let op = "";
  let service = name;
  for (const suffix of KNOWN_OPS) {
    if (name.toLowerCase().endsWith(suffix.toLowerCase())) {
      op = suffix;
      service = name.slice(0, name.length - suffix.length).trim().replace(/[:\s]+$/, "");
      break;
    }
  }
  return {
    pg,
    service: service || name,
    op,
    level: permLevel(pg),
  };
}

interface ServiceGroup {
  service: string;
  scope: string;
  perms: ParsedPerm[];
  hasWrite: boolean;
  hasRead: boolean;
  opCount: number;
  readOnly: boolean;   // 只有 Read，没有 Write
  multiOp: boolean;   // 3+ 个操作
}

/** 按服务分组，支持分类过滤 */
const serviceGroups = computed<ServiceGroup[]>(() => {
  const filter = permFilter.value;
  const parsed = permissionGroups.value
    .filter((pg) => matchesFilter(pg, filter))
    .map(parsePerm);

  const map = new Map<string, ServiceGroup>();
  for (const p of parsed) {
    const scope = p.pg.scopes?.[0] ?? "其他";
    const key = `${scope}::${p.service}`;
    if (!map.has(key)) {
      map.set(key, {
        service: p.service,
        scope,
        perms: [],
        hasWrite: false,
        hasRead: false,
        opCount: 0,
        readOnly: false,
        multiOp: false,
      });
    }
    const g = map.get(key)!;
    g.perms.push(p);
    if (p.level === "write") g.hasWrite = true;
    if (p.level === "read") g.hasRead = true;
  }

  const groups = [...map.values()];
  for (const g of groups) {
    // 去重操作名
    const ops = new Set(g.perms.map((p) => p.op));
    g.opCount = ops.size;
    g.readOnly = g.hasRead && !g.hasWrite;
    g.multiOp = g.opCount >= 3;
  }

  // 排序：有写的优先，仅读的排后面，按名称字母序
  groups.sort((a, b) => {
    if (a.readOnly !== b.readOnly) return a.readOnly ? 1 : -1;
    return a.service.localeCompare(b.service);
  });

  return groups;
});

/** 按 scope 再分组 service groups */
const scopedServiceGroups = computed(() => {
  const map = new Map<string, ServiceGroup[]>();
  for (const g of serviceGroups.value) {
    if (!map.has(g.scope)) map.set(g.scope, []);
    map.get(g.scope)!.push(g);
  }
  return map;
});

// ---- 选择操作 ----

function togglePerm(id: string) {
  const idx = selectedPermIds.value.indexOf(id);
  if (idx >= 0) {
    selectedPermIds.value.splice(idx, 1);
  } else {
    selectedPermIds.value.push(id);
  }
}

function isPermSelected(id: string): boolean {
  return selectedPermIds.value.includes(id);
}

/** 全选当前搜索结果 */
function selectAllFiltered() {
  const current = new Set(selectedPermIds.value);
  for (const g of serviceGroups.value) {
    for (const p of g.perms) {
      current.add(p.pg.id);
    }
  }
  selectedPermIds.value = [...current];
}

function selectFilteredRead() {
  const current = new Set(selectedPermIds.value);
  for (const g of serviceGroups.value) {
    for (const p of g.perms) {
      if (p.level === "read") current.add(p.pg.id);
    }
  }
  selectedPermIds.value = [...current];
}

function selectFilteredWrite() {
  const current = new Set(selectedPermIds.value);
  for (const g of serviceGroups.value) {
    for (const p of g.perms) {
      if (p.level === "write") current.add(p.pg.id);
    }
  }
  selectedPermIds.value = [...current];
}

function selectService(g: ServiceGroup) {
  const current = new Set(selectedPermIds.value);
  for (const p of g.perms) {
    current.add(p.pg.id);
  }
  selectedPermIds.value = [...current];
}

function selectServiceByLevel(g: ServiceGroup, level: "read" | "write") {
  const current = new Set(selectedPermIds.value);
  for (const p of g.perms) {
    if (p.level === level) current.add(p.pg.id);
  }
  selectedPermIds.value = [...current];
}

function clearSelection() {
  selectedPermIds.value = [];
  permFilter.value = "";
}

// ---- 数据加载 ----

async function loadTokens() {
  loading.value = true;
  error.value = "";
  try {
    tokens.value = await listApiTokens();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadPermissionGroups() {
  try {
    permissionGroups.value = await listTokenPermissionGroups();
  } catch (e) {
    console.error("加载权限组失败", e);
  }
}

async function handleCreate() {
  if (!newName.value.trim()) {
    error.value = "请填写 Token 名称";
    return;
  }
  if (selectedPermIds.value.length === 0) {
    error.value = "请至少选择一个权限组";
    return;
  }
  creating.value = true;
  error.value = "";
  try {
    const policies = [{
      effect: "allow" as const,
      resources: { "com.cloudflare.api.user.*": "*" },
      permission_groups: selectedPermIds.value.map((id) => ({ id })),
    }];
    let expires_on: string | null = null;
    if (expiresInDays.value > 0) {
      const d = new Date();
      d.setDate(d.getDate() + expiresInDays.value);
      expires_on = d.toISOString();
    }
    const result = await createApiToken({
      name: newName.value.trim(),
      policies,
      expires_on,
    });
    createdTokenValue.value = result.value ?? null;
    await loadTokens();
    newName.value = "";
    selectedPermIds.value = [];
    expiresInDays.value = 0;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    creating.value = false;
  }
}

async function handleDelete(tokenId: string) {
  try {
    await deleteApiToken(tokenId);
    confirmDeleteId.value = null;
    await loadTokens();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function handleRotate(tokenId: string) {
  try {
    const result = await rotateApiTokenValue(tokenId);
    rotatedValue.value = result.value;
    confirmRotateId.value = null;
    await loadTokens();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedToClipboard.value = true;
    setTimeout(() => { copiedToClipboard.value = false; }, 2000);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    copiedToClipboard.value = true;
    setTimeout(() => { copiedToClipboard.value = false; }, 2000);
  }
}

function closeCreateModal() {
  showCreate.value = false;
  createdTokenValue.value = null;
  newName.value = "";
  selectedPermIds.value = [];
  expiresInDays.value = 0;
  permFilter.value = "";
  error.value = "";
}

function formatDate(s?: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}

function permLevel(pg: CfTokenPermissionGroup): "read" | "write" | "other" {
  const name = pg.name.toLowerCase();
  if (name.includes("write") || name.includes("edit")) return "write";
  if (name.includes("read")) return "read";
  return "other";
}

function permLevelLabel(level: "read" | "write" | "other"): string {
  switch (level) {
    case "read": return "只读";
    case "write": return "读写";
    default: return "其他";
  }
}

function permLevelColor(level: "read" | "write" | "other"): string {
  switch (level) {
    case "read": return "#7aa2f7";
    case "write": return "#e0af68";
    default: return "#8b95a9";
  }
}

/** 获取 Token 的权限信息（含读写级别） */
function getTokenPerms(token: CfApiToken): Array<{ name: string; level: "read" | "write" | "other" }> {
  const result: Array<{ name: string; level: "read" | "write" | "other" }> = [];
  const seen = new Set<string>();
  for (const policy of token.policies ?? []) {
    for (const pg of policy.permission_groups ?? []) {
      if (seen.has(pg.id)) continue;
      seen.add(pg.id);
      const found = permissionGroups.value.find((p) => p.id === pg.id);
      if (found) {
        result.push({ name: found.name, level: permLevel(found) });
      }
    }
  }
  return result;
}

function statusColor(status: string): string {
  switch (status) {
    case "active": return "#73daca";
    case "expired": return "#ff7a6e";
    case "expiring": return "#e0af68";
    default: return "#8b95a9";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active": return "活跃";
    case "expired": return "已过期";
    case "expiring": return "即将过期";
    case "deleted": return "已删除";
    default: return status;
  }
}

onMounted(() => {
  loadTokens();
  loadPermissionGroups();
});
</script>

<template>
  <div class="tokens">
    <div class="header">
      <h2>API 令牌</h2>
      <button class="btn-add" @click="showCreate = true">+ 新建令牌</button>
    </div>

    <p v-if="error" class="warn">{{ error }}</p>

    <div v-if="loading" class="skeleton">正在加载…</div>

    <div v-else-if="tokens.length === 0" class="empty">
      <p>暂无 API 令牌</p>
      <button class="btn-add" @click="showCreate = true">创建第一个令牌</button>
    </div>

    <div v-else class="list">
      <div v-for="t in tokens" :key="t.id" class="token-card">
        <div class="token-head">
          <span class="token-name">{{ t.name }}</span>
          <span class="token-status" :style="{ color: statusColor(t.status), borderColor: statusColor(t.status) }">
            {{ statusLabel(t.status) }}
          </span>
        </div>
        <div class="token-meta">
          <span>创建：{{ formatDate(t.created_on) }}</span>
          <span>最后使用：{{ formatDate(t.last_used_on) }}</span>
          <span v-if="t.expires_on">过期：{{ formatDate(t.expires_on) }}</span>
          <span v-else>永不过期</span>
        </div>
        <div v-if="getTokenPerms(t).length" class="token-perms">
          <span
            v-for="p in getTokenPerms(t)"
            :key="p.name"
            class="perm-tag"
            :style="{ color: permLevelColor(p.level), background: permLevelColor(p.level) + '1f' }"
          >
            {{ p.name }} · {{ permLevelLabel(p.level) }}
          </span>
        </div>
        <div class="token-actions">
          <button class="btn-sm btn-rotate" @click="confirmRotateId = t.id">轮换</button>
          <button class="btn-sm btn-del" @click="confirmDeleteId = t.id">删除</button>
        </div>
      </div>
    </div>

    <!-- 创建 Token 弹窗 -->
    <div v-if="showCreate" class="modal-overlay">
      <div class="modal">
        <div class="modal-head">
          <h3>新建 API 令牌</h3>
          <button class="modal-close" @click="closeCreateModal">✕</button>
        </div>

        <!-- 创建成功后显示 Token 值 -->
        <div v-if="createdTokenValue" class="token-result">
          <div class="result-warn">
            ⚠️ 请立即复制保存此令牌值，关闭后无法再次查看。
          </div>
          <div class="token-value-box">
            <code>{{ createdTokenValue }}</code>
            <button class="btn-copy" @click="copyText(createdTokenValue)">
              {{ copiedToClipboard ? "已复制" : "复制" }}
            </button>
          </div>
          <button class="btn-done" @click="closeCreateModal">完成</button>
        </div>

        <!-- 创建表单 -->
        <div v-else class="modal-body">
          <div class="field">
            <label>名称</label>
            <input v-model="newName" type="text" placeholder="例如：CI 部署令牌" />
          </div>

          <div class="field">
            <label>权限组（{{ selectedPermIds.length }} 个已选）</label>

            <!-- 分类按钮 -->
            <div class="filter-tabs">
              <button class="filter-tab" :class="{ active: permFilter === 'dns' }" @click="setPermFilter('dns')">编辑区域 DNS</button>
              <button class="filter-tab" :class="{ active: permFilter === 'workers' }" @click="setPermFilter('workers')">编辑 Cloudflare Workers</button>
              <button class="filter-tab" :class="{ active: permFilter === 'database' }" @click="setPermFilter('database')">编辑数据库</button>
              <button class="filter-tab" :class="{ active: permFilter === 'custom' }" @click="setPermFilter('custom')">自定义令牌</button>
            </div>

            <div v-if="permissionGroups.length === 0" class="perm-loading">正在加载权限组…</div>
            <div v-else class="perm-groups">
              <!-- 全局工具栏 -->
              <div class="perm-toolbar">
                <button class="btn-sm btn-selectall" @click="selectAllFiltered">全选</button>
                <button class="btn-sm btn-selectall" @click="selectFilteredRead">全选只读</button>
                <button class="btn-sm btn-selectall" @click="selectFilteredWrite">全选读写</button>
                <button class="btn-sm btn-clear" @click="clearSelection">清空</button>
              </div>

              <!-- 图例 -->
              <div class="legend">
                <span class="legend-item"><span class="dot dot-read"></span>只读</span>
                <span class="legend-item"><span class="dot dot-write"></span>读写</span>
                <span class="legend-item"><span class="dot dot-readonly"></span>仅读（无编辑权限）</span>
                <span class="legend-item"><span class="dot dot-multi"></span>多权限</span>
              </div>

              <!-- 按 scope → service 分组 -->
              <div v-for="[scope, groups] in scopedServiceGroups" :key="scope" class="scope-section">
                <div class="scope-label">{{ scope }}</div>

                <div v-for="g in groups" :key="g.service" class="service-card" :class="{ 'service-readonly': g.readOnly }">
                  <div class="service-head">
                    <div class="service-name">{{ g.service }}</div>
                    <div class="service-badges">
                      <span v-if="g.readOnly" class="badge badge-readonly">仅读</span>
                      <span v-if="g.multiOp" class="badge badge-multi">{{ g.opCount }}权限</span>
                      <button class="btn-sm btn-service" @click="selectService(g)">全选</button>
                      <button v-if="g.hasRead" class="btn-sm btn-service" @click="selectServiceByLevel(g, 'read')">只读</button>
                      <button v-if="g.hasWrite" class="btn-sm btn-service" @click="selectServiceByLevel(g, 'write')">读写</button>
                    </div>
                  </div>
                  <div class="service-ops">
                    <label
                      v-for="p in g.perms"
                      :key="p.pg.id"
                      class="op-chip"
                      :class="{
                        'op-selected': isPermSelected(p.pg.id),
                        'op-read': p.level === 'read',
                        'op-write': p.level === 'write',
                        'op-other': p.level === 'other',
                      }"
                    >
                      <input
                        type="checkbox"
                        :checked="isPermSelected(p.pg.id)"
                        @change="togglePerm(p.pg.id)"
                      />
                      <span>{{ p.op || p.pg.name }}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div v-if="serviceGroups.length === 0" class="perm-loading">
                该分类下无权限组，点击其他分类查看
              </div>
            </div>
          </div>

          <div class="field">
            <label>有效期</label>
            <select v-model.number="expiresInDays">
              <option :value="0">永不过期</option>
              <option :value="1">1 天</option>
              <option :value="7">7 天</option>
              <option :value="30">30 天</option>
              <option :value="90">90 天</option>
              <option :value="365">1 年</option>
            </select>
          </div>

          <p v-if="error" class="warn">{{ error }}</p>

          <div class="modal-actions">
            <button class="btn-cancel" @click="closeCreateModal">取消</button>
            <button class="btn-confirm" :disabled="creating" @click="handleCreate">
              {{ creating ? "创建中…" : "创建令牌" }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="confirmDeleteId" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3>确认删除</h3>
          <button class="modal-close" @click="confirmDeleteId = null">✕</button>
        </div>
        <p class="confirm-text">删除后无法恢复，确定要删除此令牌吗？</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="confirmDeleteId = null">取消</button>
          <button class="btn-del" @click="handleDelete(confirmDeleteId)">确认删除</button>
        </div>
      </div>
    </div>

    <!-- 轮换确认 + 结果 -->
    <div v-if="confirmRotateId" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3>轮换令牌值</h3>
          <button class="modal-close" @click="confirmRotateId = null; rotatedValue = null">✕</button>
        </div>
        <p class="confirm-text">轮换后原令牌值立即失效，将生成新值。确定继续？</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="confirmRotateId = null; rotatedValue = null">取消</button>
          <button class="btn-confirm" @click="handleRotate(confirmRotateId)">确认轮换</button>
        </div>
      </div>
    </div>

    <!-- 轮换结果 -->
    <div v-if="rotatedValue" class="modal-overlay">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3>新令牌值</h3>
          <button class="modal-close" @click="rotatedValue = null">✕</button>
        </div>
        <div class="result-warn">⚠️ 请立即复制保存，关闭后无法再次查看。</div>
        <div class="token-value-box">
          <code>{{ rotatedValue }}</code>
          <button class="btn-copy" @click="copyText(rotatedValue)">
            {{ copiedToClipboard ? "已复制" : "复制" }}
          </button>
        </div>
        <button class="btn-done" @click="rotatedValue = null">完成</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tokens {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header h2 {
  margin: 0;
  font-size: 20px;
}
.btn-add {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(246, 154, 34, 0.4);
  background: rgba(246, 154, 34, 0.12);
  color: #f69a22;
  font-size: 13px;
  cursor: pointer;
}
.warn {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 122, 110, 0.12);
  color: #ff7a6e;
  font-size: 13px;
}
.skeleton {
  padding: 24px;
  text-align: center;
  color: #8b95a9;
  font-size: 14px;
}
.empty {
  padding: 32px 16px;
  text-align: center;
  color: #8b95a9;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.token-card {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.token-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.token-name {
  font-weight: 600;
  font-size: 15px;
}
.token-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid;
}
.token-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #8b95a9;
}
.token-perms {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.perm-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
}
.token-actions {
  display: flex;
  gap: 8px;
}
.btn-sm {
  padding: 4px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: #aab3c5;
  font-size: 12px;
  cursor: pointer;
}
.btn-rotate {
  border-color: rgba(122, 162, 247, 0.4);
  color: #7aa2f7;
}
.btn-del {
  border-color: rgba(255, 122, 110, 0.3);
  color: #ff7a6e;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.modal {
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  background: #131c2e;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.modal-sm {
  max-width: 360px;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  background: #131c2e;
  z-index: 1;
}
.modal-head h3 {
  margin: 0;
  font-size: 16px;
}
.modal-close {
  background: none;
  border: none;
  color: #8b95a9;
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
}
.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field label {
  font-size: 13px;
  color: #aab3c5;
}
.field input[type="text"],
.field select {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #e8edf5;
  font-size: 14px;
}
.perm-loading {
  color: #8b95a9;
  font-size: 13px;
  padding: 8px 0;
}

/* 权限选择区域 */
.filter-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-tab {
  padding: 6px 14px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: #aab3c5;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.filter-tab:hover {
  border-color: rgba(246, 154, 34, 0.3);
  color: #e8edf5;
}
.filter-tab.active {
  border-color: rgba(246, 154, 34, 0.5);
  background: rgba(246, 154, 34, 0.15);
  color: #f69a22;
  font-weight: 600;
}
.perm-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.perm-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.perm-toolbar .btn-sm,
.service-badges .btn-sm {
  font-size: 11px;
  padding: 3px 10px;
}
.btn-selectall {
  border-color: rgba(122, 162, 247, 0.3);
  color: #7aa2f7;
}
.btn-clear {
  border-color: rgba(255, 122, 110, 0.3);
  color: #ff7a6e;
}

/* 图例 */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: #8b95a9;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.dot-read { background: #7aa2f7; }
.dot-write { background: #e0af68; }
.dot-readonly { background: #ff7a6e; }
.dot-multi { background: #bb9af7; }

/* scope 分区 */
.scope-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.scope-label {
  font-size: 11px;
  color: #f69a22;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 0 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.scope-section:first-child .scope-label {
  border-top: none;
  padding-top: 0;
}

/* 服务卡片 */
.service-card {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}
.service-card.service-readonly {
  border-color: rgba(255, 122, 110, 0.2);
  background: rgba(255, 122, 110, 0.04);
}
.service-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 6px;
}
.service-name {
  font-size: 12px;
  font-weight: 600;
  color: #c0c8d8;
}
.service-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.badge-readonly {
  background: rgba(255, 122, 110, 0.15);
  color: #ff7a6e;
}
.badge-multi {
  background: rgba(187, 154, 247, 0.15);
  color: #bb9af7;
}
.btn-service {
  font-size: 10px !important;
  padding: 2px 8px !important;
  border-color: rgba(255, 255, 255, 0.1) !important;
}

/* 操作选项 */
.service-ops {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.op-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  cursor: pointer;
  color: #8b95a9;
  user-select: none;
}
.op-chip input[type="checkbox"] {
  width: 12px;
  height: 12px;
  accent-color: #f69a22;
  margin: 0;
}
.op-chip.op-read { border-color: rgba(122, 162, 247, 0.25); }
.op-chip.op-write { border-color: rgba(224, 175, 104, 0.25); }
.op-chip.op-other { border-color: rgba(139, 149, 169, 0.2); }
.op-chip.op-selected {
  color: #e8edf5;
}
.op-chip.op-selected.op-read {
  background: rgba(122, 162, 247, 0.15);
  border-color: #7aa2f7;
}
.op-chip.op-selected.op-write {
  background: rgba(224, 175, 104, 0.15);
  border-color: #e0af68;
}
.op-chip.op-selected.op-other {
  background: rgba(139, 149, 169, 0.15);
  border-color: #8b95a9;
}

/* 模态框底部按钮 */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 0 20px 20px;
}
.btn-cancel {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: #aab3c5;
  font-size: 13px;
  cursor: pointer;
}
.btn-confirm {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(246, 154, 34, 0.4);
  background: rgba(246, 154, 34, 0.15);
  color: #f69a22;
  font-size: 13px;
  cursor: pointer;
}
.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.confirm-text {
  padding: 16px 20px;
  font-size: 14px;
  color: #c0c8d8;
  margin: 0;
}

/* Token 值展示 */
.token-result {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.result-warn {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(224, 175, 104, 0.12);
  color: #e0af68;
  font-size: 13px;
}
.token-value-box {
  display: flex;
  gap: 8px;
  align-items: center;
}
.token-value-box code {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  color: #73daca;
  word-break: break-all;
  font-family: "SF Mono", "Cascadia Code", monospace;
}
.btn-copy {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(115, 218, 202, 0.3);
  background: rgba(115, 218, 202, 0.1);
  color: #73daca;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.btn-done {
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #e8edf5;
  font-size: 14px;
  cursor: pointer;
}
</style>
