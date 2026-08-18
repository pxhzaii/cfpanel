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

// 删除确认
const confirmDeleteId = ref<string | null>(null);

// 轮换确认
const confirmRotateId = ref<string | null>(null);
const rotatedValue = ref<string | null>(null);

// 预设模板
type TemplateKey = "custom" | "panel_admin" | "read_all" | "dns_edit";
const selectedTemplate = ref<TemplateKey>("custom");

const templates: Record<TemplateKey, { label: string; desc: string; permIds: string[] }> = {
  custom: { label: "自定义", desc: "手动选择权限组", permIds: [] },
  panel_admin: { label: "面板管理（完整）", desc: "Workers / Pages / 存储 / DNS 等全部读写", permIds: [] },
  read_all: { label: "只读全部", desc: "所有资源只读访问", permIds: [] },
  dns_edit: { label: "DNS 编辑", desc: "Zone DNS 记录读写", permIds: [] },
};

// 按 scope 分类的权限组
const groupedPermissions = computed(() => {
  const groups: Record<string, CfTokenPermissionGroup[]> = {};
  for (const pg of permissionGroups.value) {
    const scope = pg.scopes?.[0] ?? "其他";
    if (!groups[scope]) groups[scope] = [];
    groups[scope].push(pg);
  }
  return groups;
});

function applyTemplate(key: TemplateKey) {
  selectedTemplate.value = key;
  if (key === "custom") {
    selectedPermIds.value = [];
    return;
  }
  const matching = permissionGroups.value.filter((pg) => {
    const name = pg.name.toLowerCase();
    const scopes = pg.scopes ?? [];
    if (key === "panel_admin") {
      // 匹配包含 account 或 zone 级别的写权限
      return scopes.some((s) => s.includes("account") || s.includes("zone")) &&
        (name.includes("write") || name.includes("edit"));
    }
    if (key === "read_all") {
      return name.includes("read");
    }
    if (key === "dns_edit") {
      return name.includes("dns") && (name.includes("write") || name.includes("edit"));
    }
    return false;
  });
  selectedPermIds.value = matching.map((m) => m.id);
}

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
    // 权限组加载失败不阻塞页面
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
    // 构建 policies
    // resources 用 "com.cloudflare.api.account.*" 表示账号级资源
    const policies = [{
      effect: "allow" as const,
      resources: { "com.cloudflare.api.user.*": "*" },
      permission_groups: selectedPermIds.value.map((id) => ({ id })),
    }];

    // 计算过期时间
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
    // 重置表单
    newName.value = "";
    selectedPermIds.value = [];
    expiresInDays.value = 0;
    selectedTemplate.value = "custom";
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
    // fallback
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
  selectedTemplate.value = "custom";
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

/** 判断权限组是读还是写 */
/** 全选所有权限组 */
function selectAllPerms() {
  selectedPermIds.value = permissionGroups.value.map((pg) => pg.id);
  selectedTemplate.value = "custom";
}

/** 按读写级别全选 */
function selectPermsByLevel(level: "read" | "write") {
  selectedPermIds.value = permissionGroups.value
    .filter((pg) => permLevel(pg) === level)
    .map((pg) => pg.id);
  selectedTemplate.value = "custom";
}

/** 按 scope + 读写级别全选 */
function selectScopeByLevel(scope: string, level: "read" | "write") {
  const grouped = groupedPermissions.value;
  const pgs = grouped[scope] ?? [];
  const ids = pgs.filter((pg) => permLevel(pg) === level).map((pg) => pg.id);
  // 合并到已选（而非替换），实现多个 scope 累加选择
  const current = new Set(selectedPermIds.value);
  for (const id of ids) current.add(id);
  selectedPermIds.value = [...current];
  selectedTemplate.value = "custom";
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
            <label>快速模板</label>
            <div class="template-grid">
              <button
                v-for="(tpl, key) in templates"
                :key="key"
                class="template-card"
                :class="{ active: selectedTemplate === key }"
                @click="applyTemplate(key as TemplateKey)"
              >
                <div class="tpl-label">{{ tpl.label }}</div>
                <div class="tpl-desc">{{ tpl.desc }}</div>
              </button>
            </div>
          </div>

          <div class="field">
            <label>权限组（{{ selectedPermIds.length }} 个已选）</label>
            <div v-if="permissionGroups.length === 0" class="perm-loading">正在加载权限组…</div>
            <div v-else class="perm-groups">
              <div class="perm-toolbar">
                <button class="btn-sm btn-selectall" @click="selectAllPerms">全选</button>
                <button class="btn-sm btn-selectall" @click="selectPermsByLevel('read')">全选只读</button>
                <button class="btn-sm btn-selectall" @click="selectPermsByLevel('write')">全选读写</button>
                <button class="btn-sm btn-clear" @click="selectedPermIds = []">清空</button>
              </div>
              <div v-for="(pgs, scope) in groupedPermissions" :key="scope" class="perm-group">
                <div class="perm-scope-row">
                  <div class="perm-scope">{{ scope }}</div>
                  <button class="btn-sm btn-selectall" @click="selectScopeByLevel(scope, 'read')">全选只读</button>
                  <button class="btn-sm btn-selectall" @click="selectScopeByLevel(scope, 'write')">全选读写</button>
                </div>
                <label v-for="pg in pgs" :key="pg.id" class="perm-item">
                  <input
                    type="checkbox"
                    :value="pg.id"
                    v-model="selectedPermIds"
                  />
                  <span>{{ pg.name }}</span>
                  <span class="perm-level" :style="{ color: permLevelColor(permLevel(pg)) }">{{ permLevelLabel(permLevel(pg)) }}</span>
                </label>
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
  background: rgba(122, 162, 247, 0.12);
  color: #7aa2f7;
}
.perm-level {
  font-size: 10px;
  margin-left: auto;
  opacity: 0.8;
  font-weight: 600;
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
.template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.template-card {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  text-align: left;
  cursor: pointer;
  color: #e8edf5;
}
.template-card.active {
  border-color: #f69a22;
  background: rgba(246, 154, 34, 0.08);
}
.tpl-label {
  font-size: 13px;
  font-weight: 600;
}
.tpl-desc {
  font-size: 11px;
  color: #8b95a9;
  margin-top: 2px;
}
.perm-loading {
  color: #8b95a9;
  font-size: 13px;
  padding: 8px 0;
}
.perm-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.perm-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.perm-toolbar .btn-sm {
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
.perm-scope-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.perm-scope-row .btn-sm {
  font-size: 10px;
  padding: 2px 8px;
}
.perm-group {
  padding: 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.perm-group:first-child {
  border-top: none;
}
.perm-scope {
  font-size: 11px;
  color: #f69a22;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.perm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  cursor: pointer;
  font-size: 12px;
  color: #c0c8d8;
}
.perm-item input[type="checkbox"] {
  accent-color: #f69a22;
}
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
