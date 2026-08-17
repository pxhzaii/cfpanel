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
  const user = await handle<CfUser>(res);
  auth.pass = pass;
  auth.user = user;
  return user;
}

export function logout() {
  auth.clear();
  auth.clearUser();
  auth.clearZones();
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

// ---------------- Workers ----------------

export async function listWorkers(params?: PageParams): Promise<CfWorkerScript[]> {
  return proxy<CfWorkerScript[]>("GET", "accounts/self/workers/scripts", undefined, {
    ...params,
    "per_page": 50,
  });
}

export async function getWorkerScript(scriptName: string): Promise<string> {
  return proxy<string>("GET", `accounts/self/workers/scripts/${scriptName}/content`);
}

// ---------------- Pages ----------------

export async function listPagesProjects(params?: PageParams): Promise<CfPagesProject[]> {
  return proxy<CfPagesProject[]>("GET", "accounts/self/pages/projects", undefined, {
    ...params,
    "per_page": 50,
  });
}

export async function listPagesDeployments(projectName: string): Promise<CfPagesDeployment[]> {
  return proxy<CfPagesDeployment[]>("GET", `accounts/self/pages/projects/${projectName}/deployments`);
}

// ---------------- KV ----------------

export async function listKvNamespaces(params?: PageParams): Promise<CfKvNamespace[]> {
  return proxy<CfKvNamespace[]>("GET", "accounts/self/storage/kv/namespaces", undefined, {
    ...params,
    "per_page": 50,
  });
}

export async function listKvKeys(namespaceId: string, prefix?: string): Promise<CfKvKey[]> {
  return proxy<CfKvKey[]>("GET", `accounts/self/storage/kv/namespaces/${namespaceId}/keys`, undefined, {
    prefix: prefix ?? undefined,
    "per_page": 100,
  });
}

export async function getKvValue(namespaceId: string, key: string): Promise<string> {
  return proxy<string>("GET", `accounts/self/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`);
}

export async function putKvValue(namespaceId: string, key: string, value: string): Promise<unknown> {
  return proxy("PUT", `accounts/self/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, undefined, {
    value,
  });
}

export async function deleteKvKey(namespaceId: string, key: string): Promise<unknown> {
  return proxy("DELETE", `accounts/self/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`);
}

// ---------------- R2 ----------------

export async function listR2Buckets(params?: PageParams): Promise<CfR2Bucket[]> {
  return proxy<CfR2Bucket[]>("GET", "accounts/self/r2/buckets", undefined, {
    ...params,
    "per_page": 50,
  });
}

// ---------------- D1 ----------------

export async function listD1Databases(): Promise<CfD1Database[]> {
  return proxy<CfD1Database[]>("GET", "accounts/self/d1/database");
}

export async function runD1Query(databaseId: string, sql: string): Promise<CfD1QueryResult> {
  return proxy<CfD1QueryResult>("POST", `accounts/self/d1/database/${databaseId}/query`, { sql });
}

// ---------------- 账号信息 ----------------

export async function listAccounts(): Promise<CfAccount[]> {
  return proxy<CfAccount[]>("GET", "accounts");
}