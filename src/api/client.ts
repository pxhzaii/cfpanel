/**
 * API 客户端：所有请求都经过 /api/proxy/ 代理，
 * 访问口令通过请求头 X-Panel-Pass 传递，CF_API_TOKEN 始终留在服务端。
 */
import type {
  CfResponse,
  CfUser,
  CfZone,
  CfDnsRecord,
  CfWorkerScript,
  CfPagesProject,
  CfPagesDeployment,
  CfKvNamespace,
  CfKvKey,
  CfR2Bucket,
  CfD1Database,
  CfD1QueryResult,
  CfAccount,
  PageParams,
  DnsRecordForm,
} from "./types";

const PASS_KEY = "cfpanel_pass";
const USER_KEY = "cfpanel_user";
const ZONES_KEY = "cfpanel_zones";
const ACCOUNT_KEY = "cfpanel_account";

export const auth = {
  get pass(): string | null {
    return localStorage.getItem(PASS_KEY);
  },
  set pass(v: string) {
    localStorage.setItem(PASS_KEY, v);
  },
  clear() {
    localStorage.removeItem(PASS_KEY);
  },
  get user(): CfUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CfUser) : null;
  },
  set user(v: CfUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(v));
  },
  clearUser() {
    localStorage.removeItem(USER_KEY);
  },
  get zones(): CfZone[] {
    const raw = localStorage.getItem(ZONES_KEY);
    return raw ? (JSON.parse(raw) as CfZone[]) : [];
  },
  set zones(v: CfZone[]) {
    localStorage.setItem(ZONES_KEY, JSON.stringify(v));
  },
  clearZones() {
    localStorage.removeItem(ZONES_KEY);
  },
  get accountId(): string {
    return localStorage.getItem(ACCOUNT_KEY) ?? "";
  },
  set accountId(v: string) {
    localStorage.setItem(ACCOUNT_KEY, v);
  },
};

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function qs(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** 解析代理返回的 JSON，统一抛错 */
async function handle<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: CfResponse<T>;
  try {
    data = JSON.parse(text) as CfResponse<T>;
  } catch {
    throw new ApiError(res.status, `响应解析失败（HTTP ${res.status}）`);
  }
  if (!res.ok || !data.success) {
    const msg =
      data.errors?.[0]?.message ??
      (data as CfResponse & { error?: string }).error ??
      `请求失败（HTTP ${res.status}）`;
    throw new ApiError(res.status, msg);
  }
  return data.result;
}

/** 通用代理请求 */
async function proxy<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const token = auth.pass;
  if (!token) throw new ApiError(401, "未登录");
  const res = await fetch(`/api/proxy/${path}${qs(params)}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Panel-Pass": token,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}

// ---------------- 账号与登录 ----------------

export async function login(pass: string): Promise<CfUser> {
  const res = await fetch("/api/proxy/user/tokens/verify", {
    method: "GET",
    headers: { "X-Panel-Pass": pass },
  });
  // 只校验口令是否有效（不解析 result 细节，避免 Token 类型差异导致解析失败）
  await handle<unknown>(res);
  auth.pass = pass;
  // 获取真实 Account ID 并缓存，后续所有 account 级 API 都基于它拼接
  let accountId = "";
  let accountName = "CF Panel 用户";
  try {
    const accounts = await proxy<CfAccount[]>("GET", "accounts");
    if (accounts.length > 0) {
      accountId = accounts[0].id;
      accountName = accounts[0].name;
    }
  } catch {
    // 无 accounts 权限时静默忽略，accountId 保持为空，相关功能会提示无权限
  }
  auth.accountId = accountId;
  const user: CfUser = { id: accountId, email: accountName, username: accountName };
  auth.user = user;
  return user;
}

export function logout() {
  auth.clear();
  auth.clearUser();
  auth.clearZones();
  localStorage.removeItem(ACCOUNT_KEY);
}

// ---------------- 域名 / DNS ----------------

export async function listZones(params?: PageParams): Promise<CfZone[]> {
  const zones = await proxy<CfZone[]>("GET", "zones", undefined, {
    ...params,
    "per_page": 50,
  });
  auth.zones = zones;
  return zones;
}

export async function listDnsRecords(zoneId: string, params?: PageParams): Promise<CfDnsRecord[]> {
  return proxy<CfDnsRecord[]>("GET", `zones/${zoneId}/dns_records`, undefined, {
    ...params,
    "per_page": 100,
  });
}

export async function createDnsRecord(zoneId: string, data: DnsRecordForm): Promise<CfDnsRecord> {
  return proxy<CfDnsRecord>("POST", `zones/${zoneId}/dns_records`, data);
}

export async function updateDnsRecord(zoneId: string, recordId: string, data: DnsRecordForm): Promise<CfDnsRecord> {
  return proxy<CfDnsRecord>("PUT", `zones/${zoneId}/dns_records/${recordId}`, data);
}

export async function deleteDnsRecord(zoneId: string, recordId: string): Promise<unknown> {
  return proxy("DELETE", `zones/${zoneId}/dns_records/${recordId}`);
}

/** account 级 API 前缀（登录时自动获取真实 Account ID） */
function accountPrefix(): string {
  const id = auth.accountId;
  if (!id) throw new ApiError(401, "未获取到 Account ID，请退出重新登录");
  return `accounts/${id}`;
}

// ---------------- Workers ----------------

export async function listWorkers(params?: PageParams): Promise<CfWorkerScript[]> {
  return proxy<CfWorkerScript[]>("GET", `${accountPrefix()}/workers/scripts`, undefined, {
    ...params,
    "per_page": 50,
  });
}

export async function getWorkerScript(scriptName: string): Promise<string> {
  return proxy<string>("GET", `${accountPrefix()}/workers/scripts/${scriptName}/content`);
}

// ---------------- Pages ----------------

export async function listPagesProjects(): Promise<CfPagesProject[]> {
  // CF Pages API 不支持 per_page 参数，省略分页参数
  return proxy<CfPagesProject[]>("GET", `${accountPrefix()}/pages/projects`);
}

export async function listPagesDeployments(projectName: string): Promise<CfPagesDeployment[]> {
  return proxy<CfPagesDeployment[]>("GET", `${accountPrefix()}/pages/projects/${projectName}/deployments`);
}

// ---------------- KV ----------------

export async function listKvNamespaces(params?: PageParams): Promise<CfKvNamespace[]> {
  return proxy<CfKvNamespace[]>("GET", `${accountPrefix()}/storage/kv/namespaces`, undefined, {
    ...params,
    "per_page": 50,
  });
}

export async function listKvKeys(namespaceId: string, prefix?: string): Promise<CfKvKey[]> {
  return proxy<CfKvKey[]>("GET", `${accountPrefix()}/storage/kv/namespaces/${namespaceId}/keys`, undefined, {
    prefix: prefix ?? undefined,
    "per_page": 100,
  });
}

export async function getKvValue(namespaceId: string, key: string): Promise<string> {
  return proxy<string>("GET", `${accountPrefix()}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`);
}

export async function putKvValue(namespaceId: string, key: string, value: string): Promise<unknown> {
  return proxy("PUT", `${accountPrefix()}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, undefined, {
    value,
  });
}

export async function deleteKvKey(namespaceId: string, key: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`);
}

// ---------------- R2 ----------------

export async function listR2Buckets(params?: PageParams): Promise<CfR2Bucket[]> {
  const result = await proxy<{ buckets: CfR2Bucket[] }>("GET", `${accountPrefix()}/r2/buckets`, undefined, {
    ...params,
    "per_page": 50,
  });
  // CF R2 API 返回 { buckets: [...] } 而非直接数组
  return result?.buckets ?? [];
}

// ---------------- D1 ----------------

export async function listD1Databases(): Promise<CfD1Database[]> {
  return proxy<CfD1Database[]>("GET", `${accountPrefix()}/d1/database`);
}

export async function runD1Query(databaseId: string, sql: string): Promise<CfD1QueryResult> {
  return proxy<CfD1QueryResult>("POST", `${accountPrefix()}/d1/database/${databaseId}/query`, { sql });
}

// ---------------- 账号信息 ----------------

export async function listAccounts(): Promise<CfAccount[]> {
  return proxy<CfAccount[]>("GET", "accounts");
}