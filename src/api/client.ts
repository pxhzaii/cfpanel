/**
 * API 客户端：所有请求都经过 /api/proxy/ 代理，
 * 用户名通过请求头 X-Panel-User 传递，密码通过 X-Panel-Pass 传递，
 * CF_API_TOKEN 始终留在服务端。
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
  CfR2BucketDetail,
  CfR2Object,
  CfR2ObjectContent,
  CfR2CorsConfig,
  CfR2CustomDomain,
  CfD1Database,
  CfD1QueryResult,
  CfPagesEnvVar,
  CfWorkerSecret,
  CfWorkerBinding,
  CfWorkerSettings,
  CfPagesBindingEntry,
  CfPagesBindingMap,
  CreatePagesProjectParams,
  CreateWorkerScriptParams,
  CfAccount,
  PageParams,
  DnsRecordForm,
  CfApiToken,
  CfApiTokenValue,
  CfTokenPermissionGroup,
  CreateApiTokenParams,
} from "./types";

const PASS_KEY = "cfpanel_pass";
const USER_KEY = "cfpanel_user";
const ZONES_KEY = "cfpanel_zones";
const ACCOUNT_KEY = "cfpanel_account";
const PANEL_USER_KEY = "cfpanel_panel_user";

export const auth = {
  get pass(): string | null {
    return localStorage.getItem(PASS_KEY);
  },
  set pass(v: string) {
    localStorage.setItem(PASS_KEY, v);
  },
  get panelUser(): string {
    return localStorage.getItem(PANEL_USER_KEY) ?? "";
  },
  set panelUser(v: string) {
    localStorage.setItem(PANEL_USER_KEY, v);
  },
  clear() {
    localStorage.removeItem(PASS_KEY);
    localStorage.removeItem(PANEL_USER_KEY);
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
  // CF API 在某些操作（如 DELETE、ad_hoc 部署）成功时返回 result: null，
  // 这是正常行为，不应报错。调用方需自行处理可能为 null 的 result。
  return data.result as T;
}

/** 通用代理请求 */
async function proxy<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const pass = auth.pass;
  const panelUser = auth.panelUser;
  if (!pass || !panelUser) throw new ApiError(401, "未登录");
  const res = await fetch(`/api/proxy/${path}${qs(params)}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Panel-User": panelUser,
      "X-Panel-Pass": pass,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}

// ---------------- 账号与登录 ----------------

export async function login(username: string, pass: string): Promise<CfUser> {
  // 用 accounts 端点验证用户名+密码+Token 有效性
  const res = await fetch("/api/proxy/accounts", {
    method: "GET",
    headers: { "X-Panel-User": username, "X-Panel-Pass": pass },
  });
  const accounts = await handle<CfAccount[]>(res);
  auth.pass = pass;
  auth.panelUser = username;
  let accountId = "";
  let accountName = username;
  if (accounts && accounts.length > 0) {
    accountId = accounts[0].id;
    accountName = accounts[0].name;
  }
  auth.accountId = accountId;
  const user: CfUser = { id: accountId, email: accountName, username: username };
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
  // CF API v4 的 /content 端点 GET 已废弃（返回 405），改用 /content/v2
  // v2 返回 multipart/form-data，包含所有模块代码
  // 为避免大文件（可能 5MB+）撑爆手机浏览器，只读前 100000 字节
  const res = await fetch(`/api/proxy/${accountPrefix()}/workers/scripts/${scriptName}/content/v2`, {
    method: "GET",
    headers: { "Content-Type": "application/json", "X-Panel-User": auth.panelUser, "X-Panel-Pass": auth.pass ?? "" },
  });

  if (!res.ok) {
    return `（获取失败，HTTP ${res.status}）`;
  }

  const ct = res.headers.get("Content-Type") ?? "";

  // 如果不是 multipart（某些 Worker 返回纯文本），直接取前 50000 字符
  if (!ct.includes("multipart/form-data")) {
    const text = await res.text();
    return text.length > 50000 ? text.slice(0, 50000) + "\n\n// ... 内容过长，已截断 ..." : text;
  }

  // 读取前 100000 字节用于解析
  const reader = res.body?.getReader();
  if (!reader) return "（无法读取响应）";

  let raw = "";
  let totalBytes = 0;
  const MAX_BYTES = 100000;
  const decoder = new TextDecoder();
  while (totalBytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    raw += decoder.decode(value, { stream: true });
  }
  await reader.cancel();

  // 解析 multipart，提取各模块
  const boundary = ct.match(/boundary=([^;]+)/)?.[1] ?? "";
  const parts = raw.split("--" + boundary).filter((p) => p.trim() && !p.includes("--"));
  const modules: { name: string; code: string }[] = [];

  for (const part of parts) {
    const nameMatch = part.match(/filename="([^"]+)"/);
    const codeStart = part.indexOf("\r\n\r\n");
    if (nameMatch && codeStart >= 0) {
      modules.push({ name: nameMatch[1], code: part.slice(codeStart + 4).trim() });
    }
  }

  if (modules.length === 0) return raw.slice(0, 50000);

  let result = "";
  for (const m of modules) {
    result += `// ===== ${m.name} =====\n`;
    result += m.code;
    result += "\n\n";
    if (result.length > 50000) {
      result = result.slice(0, 50000) + "\n\n// ... 内容过长，已截断 ...";
      break;
    }
  }
  return result;
}

// ---------------- Pages ----------------

export async function listPagesProjects(): Promise<CfPagesProject[]> {
  // CF Pages API 不支持 per_page 参数，省略分页参数
  return proxy<CfPagesProject[]>("GET", `${accountPrefix()}/pages/projects`);
}

export async function listPagesDeployments(projectName: string): Promise<CfPagesDeployment[]> {
  const result = await proxy<CfPagesDeployment[]>("GET", `${accountPrefix()}/pages/projects/${projectName}/deployments`);
  return result ?? [];
}

// ---------------- KV ----------------

export async function listKvNamespaces(params?: PageParams): Promise<CfKvNamespace[]> {
  return proxy<CfKvNamespace[]>("GET", `${accountPrefix()}/storage/kv/namespaces`, undefined, {
    ...params,
    "per_page": 50,
  });
}

export async function createKvNamespace(title: string): Promise<CfKvNamespace> {
  return proxy<CfKvNamespace>("POST", `${accountPrefix()}/storage/kv/namespaces`, { title });
}

export async function deleteKvNamespace(namespaceId: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/storage/kv/namespaces/${namespaceId}`);
}

export async function listKvKeys(namespaceId: string, prefix?: string): Promise<CfKvKey[]> {
  return proxy<CfKvKey[]>("GET", `${accountPrefix()}/storage/kv/namespaces/${namespaceId}/keys`, undefined, {
    prefix: prefix ?? undefined,
    "per_page": 100,
  });
}

/**
 * KV 取值结果：文本值或二进制信息
 */
export interface KvValueResult {
  text?: string;         // 文本内容（含纯文本、JSON 等）
  binary?: {             // 二进制内容信息
    type: string;        // 原始 Content-Type
    size: number;        // 字节数
    dataUrl: string;     // base64 data URL（可直接用于 <img> 等）
  };
}

/**
 * 获取 KV 键值。
 * KV API 返回纯文本/二进制 body（非 CF 标准 JSON 包装），不能用 proxy()。
 * KV API 对所有值都返回 application/octet-stream，不能靠 Content-Type 区分，
 * 改为：先拿 arrayBuffer，尝试 UTF-8 解码——成功则当文本，失败则当二进制转 base64 预览。
 */
export async function getKvValue(namespaceId: string, key: string): Promise<KvValueResult> {
  const pass = auth.pass;
  const panelUser = auth.panelUser;
  if (!pass || !panelUser) throw new ApiError(401, "未登录");
  const res = await fetch(`/api/proxy/${accountPrefix()}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: { "X-Panel-User": panelUser, "X-Panel-Pass": pass },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = `请求失败（HTTP ${res.status}）`;
    try {
      const data = JSON.parse(text);
      msg = data.errors?.[0]?.message ?? data.error ?? msg;
    } catch { /* 非 JSON 响应 */ }
    throw new ApiError(res.status, msg);
  }
  const buf = await res.arrayBuffer();
  const ct = res.headers.get("Content-Type") ?? "";
  // 尝试 UTF-8 解码：如果不含非法字节则当文本
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const text = decoder.decode(buf);
    return { text };
  } catch {
    // 解码失败 = 真二进制，转 base64 data URL
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const mime = ct.includes("image/") ? ct : "image/x-icon";
    return { binary: { type: ct, size: buf.byteLength, dataUrl: `data:${mime};base64,${b64}` } };
  }
}

export async function putKvValue(namespaceId: string, key: string, value: string): Promise<unknown> {
  // CF KV API 要求值放在请求 body 中（纯文本），而非 query param
  // 不能用 proxy() 因为它会 JSON.stringify，KV 值需原样发送
  const token = auth.pass;
  const panelUser = auth.panelUser;
  if (!token || !panelUser) throw new ApiError(401, "未登录");
  const res = await fetch(`/api/proxy/${accountPrefix()}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "text/plain",
      "X-Panel-User": panelUser,
      "X-Panel-Pass": token,
    },
    body: value,
  });
  // KV PUT 成功通常返回空 body，手动构造成功响应
  if (!res.ok) {
    const text = await res.text();
    let msg = `请求失败（HTTP ${res.status}）`;
    try {
      const data = JSON.parse(text);
      msg = data.errors?.[0]?.message ?? data.error ?? msg;
    } catch { /* 非 JSON 响应 */ }
    throw new ApiError(res.status, msg);
  }
  return undefined;
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

export async function createR2Bucket(name: string, locationHint?: string): Promise<CfR2Bucket> {
  const body: Record<string, string> = { name };
  if (locationHint) body.locationHint = locationHint;
  return proxy<CfR2Bucket>("POST", `${accountPrefix()}/r2/buckets`, body);
}

export async function deleteR2Bucket(name: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/r2/buckets/${name}`);
}

/** R2 存储桶详情 */
export async function getR2Bucket(name: string): Promise<CfR2BucketDetail> {
  return proxy<CfR2BucketDetail>("GET", `${accountPrefix()}/r2/buckets/${name}`);
}

/** R2 对象列表 */
export async function listR2Objects(bucketName: string, params?: { cursor?: string; per_page?: number; prefix?: string }): Promise<{ result: CfR2Object[]; cursor?: string }> {
  const q: Record<string, string | number> = { per_page: params?.per_page ?? 100 };
  if (params?.cursor) q.cursor = params.cursor;
  if (params?.prefix) q.prefix = params.prefix;
  const res = await fetch(`/api/proxy/${accountPrefix()}/r2/buckets/${bucketName}/objects?${new URLSearchParams(q as Record<string, string>).toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", "X-Panel-User": auth.panelUser, "X-Panel-Pass": auth.pass ?? "" },
  });
  const data = await res.json() as CfResponse<CfR2Object[]>;
  if (!res.ok || !data.success) {
    const msg = data.errors?.[0]?.message ?? `请求失败（HTTP ${res.status}）`;
    throw new ApiError(res.status, msg);
  }
  // R2 返回 result 为数组，分页游标在 result_info.cursor
  return { result: data.result ?? [], cursor: data.result_info?.cursor };
}

/** R2 上传对象（直接发送原始二进制 body） */
export async function putR2Object(bucketName: string, key: string, rawBody: BodyInit, contentType?: string): Promise<unknown> {
  const token = auth.pass;
  const panelUser = auth.panelUser;
  if (!token || !panelUser) throw new ApiError(401, "未登录");
  const ct = contentType || "application/octet-stream";
  const res = await fetch(`/api/proxy/${accountPrefix()}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      "Content-Type": ct,
      "X-Panel-User": panelUser,
      "X-Panel-Pass": token,
    },
    body: rawBody,
  });
  return handle<unknown>(res);
}

/** R2 获取对象内容（可能返回 JSON{base64} 或原始二进制，需兼容处理） */
export async function getR2Object(bucketName: string, key: string): Promise<CfR2ObjectContent> {
  const token = auth.pass;
  const panelUser = auth.panelUser;
  if (!token || !panelUser) throw new ApiError(401, "未登录");
  const res = await fetch(`/api/proxy/${accountPrefix()}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", "X-Panel-User": panelUser, "X-Panel-Pass": token },
  });
  if (!res.ok) {
    // 尝试解析错误信息
    let msg = `请求失败（HTTP ${res.status}）`;
    try {
      const data = await res.json();
      if (data.errors?.[0]?.message) msg = data.errors[0].message;
    } catch { /* 忽略 */ }
    throw new ApiError(res.status, msg);
  }
  // R2 GET 对象可能返回两种格式：
  // 1. JSON: {result: {body: base64, contentType: ...}} — 某些 API 版本
  // 2. 原始二进制流 — Content-Type 为 image/jpeg 等
  const ct = res.headers.get("Content-Type") ?? "";
  if (ct.includes("application/json")) {
    // JSON 格式，正常解析
    const data = await res.json();
    if (!data.success) {
      throw new ApiError(res.status, data.errors?.[0]?.message ?? "请求失败");
    }
    return data.result as CfR2ObjectContent;
  } else {
    // 原始二进制流，转 base64
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    return { body: base64, contentType: ct };
  }
}

/** R2 删除对象 */
export async function deleteR2Object(bucketName: string, key: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`);
}

/** R2 清空存储桶（逐个删除所有对象） */
export async function emptyR2Bucket(bucketName: string): Promise<{ deleted: number; errors: string[] }> {
  let cursor: string | undefined;
  let deleted = 0;
  const errors: string[] = [];
  do {
    const page = await listR2Objects(bucketName, { cursor, per_page: 100 });
    for (const obj of page.result) {
      try {
        await deleteR2Object(bucketName, obj.key);
        deleted++;
      } catch (e) {
        errors.push(`${obj.key}: ${(e as Error).message}`);
      }
    }
    cursor = page.cursor;
  } while (cursor);
  return { deleted, errors };
}

/** R2 获取 CORS 策略 */
export async function getR2Cors(bucketName: string): Promise<CfR2CorsConfig> {
  return proxy<CfR2CorsConfig>("GET", `${accountPrefix()}/r2/buckets/${bucketName}/cors`);
}

/** R2 设置 CORS 策略 */
export async function setR2Cors(bucketName: string, rules: CfR2CorsConfig["rules"]): Promise<unknown> {
  // CORS 用 PUT（不是 PATCH，PATCH 返回 404）
  return proxy("PUT", `${accountPrefix()}/r2/buckets/${bucketName}/cors`, { rules });
}

/** R2 获取自定义域列表 */
export async function listR2CustomDomains(bucketName: string): Promise<CfR2CustomDomain[]> {
  const result = await proxy<{ domains: CfR2CustomDomain[] }>("GET", `${accountPrefix()}/r2/buckets/${bucketName}/custom_domains`);
  return result?.domains ?? [];
}

/** R2 添加自定义域 */
export async function addR2CustomDomain(bucketName: string, domain: string, zoneId: string, minTLS?: string): Promise<unknown> {
  const body: Record<string, string> = { domain, zoneId };
  if (minTLS) body.minTLS = minTLS;
  return proxy("POST", `${accountPrefix()}/r2/buckets/${bucketName}/custom_domains`, body);
}

/** R2 删除自定义域 */
export async function deleteR2CustomDomain(bucketName: string, domain: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/r2/buckets/${bucketName}/custom_domains/${encodeURIComponent(domain)}`);
}

// ---------------- D1 ----------------

export async function listD1Databases(): Promise<CfD1Database[]> {
  return proxy<CfD1Database[]>("GET", `${accountPrefix()}/d1/database`);
}

export async function createD1Database(name: string): Promise<CfD1Database> {
  return proxy<CfD1Database>("POST", `${accountPrefix()}/d1/database`, { name });
}

export async function deleteD1Database(databaseId: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/d1/database/${databaseId}`);
}

export async function runD1Query(databaseId: string, sql: string): Promise<CfD1QueryResult> {
  return proxy<CfD1QueryResult>("POST", `${accountPrefix()}/d1/database/${databaseId}/query`, { sql });
}

// ---------------- Pages 环境变量 ----------------

export async function getPagesEnvVars(projectName: string, env: "production" | "preview" = "production"): Promise<Record<string, CfPagesEnvVar>> {
  const proj = await getPagesProject(projectName);
  return (proj.deployment_configs?.[env]?.env_vars as Record<string, CfPagesEnvVar>) ?? {};
}

/**
 * 添加/更新 Pages 环境变量。
 * 注意：PATCH /environments/{env}/vars/{name} 端点会返回 200 但实际上不生效（CF API 的坑），
 * 必须改为 PATCH 整个项目，通过 deployment_configs.{env}.env_vars 提交。
 *
 * 重要：CF Pages 部署时会用部署记录中的 env_vars 快照覆盖项目级配置。
 * 实测发现 plain_text 类型变量在部署后会被清空（CF 平台行为），
 * 而 secret_text 类型变量能正确保留。因此本函数强制使用 secret_text 类型。
 */
export async function setPagesEnvVar(projectName: string, varName: string, value: string, env: "production" | "preview" = "production"): Promise<unknown> {
  // CF API 对 env_vars 的 PATCH 是合并语义：传入的 key 新增/更新，未传入的 key 保留原值。
  // 因此只需提交正在设置的变量，不要把 getPagesProject 返回的其他 secret_text 变量
  // （其 value 在 API 响应中为空）一起 PATCH 回去，避免用空值覆盖已有密钥。
  return proxy("PATCH", `${accountPrefix()}/pages/projects/${projectName}`, {
    deployment_configs: { [env]: { env_vars: { [varName]: { value, type: "secret_text" } } } },
  });
}

/**
 * 删除 Pages 环境变量。
 * 注意：不能直接 delete 对象属性后 PATCH（CF API 不会合并删除），
 * 必须把该变量显式设为 null，CF API 才会删除它。
 * 严禁使用 DELETE /environments/{env}/vars/{name} 端点——实测它会误删整个 Pages 项目！
 */
export async function deletePagesEnvVar(projectName: string, varName: string, env: "production" | "preview" = "production"): Promise<unknown> {
  // 只提交要删除的变量（设为 null），不把其他变量带回，避免覆盖已有 secret_text 值。
  return proxy("PATCH", `${accountPrefix()}/pages/projects/${projectName}`, {
    deployment_configs: { [env]: { env_vars: { [varName]: null } } },
  });
}

// ---------------- Pages 项目管理 ----------------

export async function createPagesProject(data: CreatePagesProjectParams): Promise<CfPagesProject> {
  return proxy<CfPagesProject>("POST", `${accountPrefix()}/pages/projects`, data);
}

export async function deletePagesProject(projectName: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/pages/projects/${projectName}`);
}

/** 获取 Pages 项目详情（含 deployment_configs 中的绑定信息） */
export async function getPagesProject(projectName: string): Promise<CfPagesProject> {
  return proxy<CfPagesProject>("GET", `${accountPrefix()}/pages/projects/${projectName}`);
}

/**
 * 手动触发 Pages 项目重新部署。
 *
 * 通过服务端 /api/redeploy 函数，用 GitHub API 推送一个 commit 到
 * 项目的 GitHub 仓库 main 分支，触发 CF Pages 的 GitHub webhook 自动部署。
 *
 * CF Pages 部署后会用部署记录中的 env_vars 覆盖项目级配置，
 * 导致通过 API 设置的变量可能丢失（plain_text 类型尤甚）。
 * 因此在触发部署前先保存快照，部署完成后客户端侧恢复，
 * 恢复时统一使用 secret_text 类型以确保部署后保留。
 *
 * 如果项目未连接 GitHub 仓库，则回退到 ad_hoc 部署（同样带恢复逻辑）。
 */
export async function createPagesDeployment(projectName: string): Promise<{ message: string; commit_sha?: string }> {
  const pass = auth.pass;
  const panelUser = auth.panelUser;
  if (!pass || !panelUser) throw new ApiError(401, "未登录");

  // 0. 部署前保存项目级配置快照（用于部署后恢复）
  const proj = await getPagesProject(projectName);
  if (!proj) {
    throw new ApiError(404, `项目 ${projectName} 不存在或已被删除`);
  }
  const savedEnvVars = (proj.deployment_configs?.production?.env_vars ?? {}) as Record<string, CfPagesEnvVar>;
  const savedKv = proj.deployment_configs?.production?.kv_namespaces ?? {};
  const savedR2 = proj.deployment_configs?.production?.r2_buckets ?? {};
  const savedD1 = proj.deployment_configs?.production?.d1_databases ?? {};

  // 尝试通过 GitHub 推 commit 触发部署
  let commitSha: string | undefined;
  try {
    const res = await fetch("/api/redeploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Panel-User": panelUser,
        "X-Panel-Pass": pass,
      },
      body: JSON.stringify({
        projectName,
        accountId: auth.accountId,
      }),
    });
    const text = await res.text();
    let data: { success: boolean; error?: string; message?: string; commit_sha?: string };
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiError(res.status, `响应解析失败（HTTP ${res.status}）`);
    }
    if (!res.ok || !data.success) {
      // 如果错误信息表明项目未连接 GitHub，则回退到 ad_hoc 部署
      if (data.error?.includes("未连接 GitHub 仓库")) {
        const result = await createPagesDeploymentAdHoc(projectName, savedEnvVars, savedKv, savedR2, savedD1);
        return result;
      }
      throw new ApiError(res.status, data.error ?? `请求失败（HTTP ${res.status}）`);
    }
    commitSha = data.commit_sha;
  } catch (e) {
    // 网络错误等情况，尝试 ad_hoc 回退
    if (e instanceof ApiError && e.message.includes("未连接 GitHub 仓库")) {
      return createPagesDeploymentAdHoc(projectName, savedEnvVars, savedKv, savedR2, savedD1);
    }
    throw e;
  }

  // 后台轮询部署状态，完成后恢复 env_vars/bindings
  void (async () => {
    const maxAttempts = 60; // 最多等 5 分钟
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const deployments = await proxy<CfPagesDeployment[]>("GET", `${accountPrefix()}/pages/projects/${projectName}/deployments`, undefined, { per_page: 1 });
        const latest = deployments?.[0];
        const stage = latest?.latest_stage;
        if (stage?.status === "success" || stage?.status === "failure" || stage?.status === "canceled") {
          break;
        }
      } catch {
        // 查询失败继续重试
      }
    }

    // 部署完成后恢复 env_vars 和 bindings
    try {
      // 恢复时统一使用 secret_text 类型，因为 plain_text 变量在部署后会被 CF 平台清空
      const restoredEnvVars: Record<string, CfPagesEnvVar> = {};
      for (const [k, v] of Object.entries(savedEnvVars)) {
        restoredEnvVars[k] = { value: v.value ?? "", type: "secret_text" };
      }
      const restoreBody: Record<string, unknown> = {
        deployment_configs: { production: {} as Record<string, unknown> },
      };
      const prod = (restoreBody.deployment_configs as { production: Record<string, unknown> }).production;
      if (Object.keys(restoredEnvVars).length > 0) {
        prod.env_vars = restoredEnvVars;
      }
      if (Object.keys(savedKv).length > 0) {
        prod.kv_namespaces = savedKv;
      }
      if (Object.keys(savedR2).length > 0) {
        prod.r2_buckets = savedR2;
      }
      if (Object.keys(savedD1).length > 0) {
        prod.d1_databases = savedD1;
      }
      if (Object.keys(prod).length > 0) {
        await proxy("PATCH", `${accountPrefix()}/pages/projects/${projectName}`, restoreBody);
      }
    } catch {
      // 恢复失败不影响部署本身
    }
  })();

  return {
    message: `已推送 commit，CF Pages 将自动部署，部署完成后自动恢复环境变量。`,
    commit_sha: commitSha,
  };
}

/**
 * ad_hoc 部署回退方案（带环境变量恢复逻辑）。
 * 仅在 GitHub 推 commit 方式不可用时使用。
 */
async function createPagesDeploymentAdHoc(
  projectName: string,
  savedEnvVars?: Record<string, CfPagesEnvVar>,
  savedKv?: Record<string, unknown>,
  savedR2?: Record<string, unknown>,
  savedD1?: Record<string, unknown>,
): Promise<{ message: string }> {
  // 如果没有传入快照，则重新获取
  if (!savedEnvVars) {
    const proj = await getPagesProject(projectName);
    if (!proj) {
      throw new ApiError(404, `项目 ${projectName} 不存在或已被删除`);
    }
    savedEnvVars = (proj.deployment_configs?.production?.env_vars ?? {}) as Record<string, CfPagesEnvVar>;
    savedKv = proj.deployment_configs?.production?.kv_namespaces ?? {};
    savedR2 = proj.deployment_configs?.production?.r2_buckets ?? {};
    savedD1 = proj.deployment_configs?.production?.d1_databases ?? {};
  }

  // 触发 ad_hoc 部署
  const res = await fetch(`/api/proxy/${accountPrefix()}/pages/projects/${projectName}/deployments`, {
    method: "POST",
    headers: { "X-Panel-User": auth.panelUser, "X-Panel-Pass": auth.pass! },
  });
  const deployment = await handle<CfPagesDeployment>(res);
  const deployId = deployment.id;

  // 后台轮询部署状态，完成后恢复
  void (async () => {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const d = await proxy<CfPagesDeployment>("GET", `${accountPrefix()}/pages/projects/${projectName}/deployments/${deployId}`);
        const stage = d.latest_stage;
        if (stage?.status === "success" || stage?.status === "failure" || stage?.status === "canceled") {
          break;
        }
      } catch {
        // 查询失败继续重试
      }
    }

    // 部署完成后恢复 env_vars 和 bindings
    try {
      // 恢复时统一使用 secret_text 类型，因为 plain_text 变量在部署后会被 CF 平台清空
      const restoredEnvVars: Record<string, CfPagesEnvVar> = {};
      if (savedEnvVars) {
        for (const [k, v] of Object.entries(savedEnvVars)) {
          restoredEnvVars[k] = { value: v.value ?? "", type: "secret_text" };
        }
      }
      const restoreBody: Record<string, unknown> = {
        deployment_configs: { production: {} as Record<string, unknown> },
      };
      const prod = (restoreBody.deployment_configs as { production: Record<string, unknown> }).production;
      if (Object.keys(restoredEnvVars).length > 0) {
        prod.env_vars = restoredEnvVars;
      }
      if (savedKv && Object.keys(savedKv).length > 0) {
        prod.kv_namespaces = savedKv;
      }
      if (savedR2 && Object.keys(savedR2).length > 0) {
        prod.r2_buckets = savedR2;
      }
      if (savedD1 && Object.keys(savedD1).length > 0) {
        prod.d1_databases = savedD1;
      }
      if (Object.keys(prod).length > 0) {
        await proxy("PATCH", `${accountPrefix()}/pages/projects/${projectName}`, restoreBody);
      }
    } catch {
      // 恢复失败不影响部署本身
    }
  })();

  return { message: "已触发 ad_hoc 部署，部署完成后将自动恢复环境变量配置" };
}

/**
 * 更新 Pages 项目绑定。
 * CF API 对绑定的 PATCH 是**合并语义**：
 *   - 传入的 key 会被新增/更新
 *   - 未传入的 key 会**保留原值**（不会自动删除！）
 *   - 要删除某个绑定，必须把该 key 显式设为 null
 *
 * 因此本函数分两段处理：
 *   1. keepBindings → 正常放入 map（新增/更新）
 *   2. removeKeys   → 在 map 中设为 null（删除）
 */
export async function updatePagesBindings(
  projectName: string,
  env: "production" | "preview",
  bindingType: "kv_namespaces" | "r2_buckets" | "d1_databases",
  keepBindings: CfPagesBindingEntry[],
  removeKeys: string[] = []
): Promise<unknown> {
  const map: CfPagesBindingMap = {};
  for (const b of keepBindings) {
    const key = b.variable_name;
    if (bindingType === "kv_namespaces") {
      map[key] = { namespace_id: b.namespace_id };
    } else if (bindingType === "r2_buckets") {
      map[key] = { name: b.bucket_name };
    } else {
      map[key] = { id: b.id };
    }
  }
  for (const key of removeKeys) {
    map[key] = null;
  }
  const patchBody = {
    deployment_configs: {
      [env]: {
        [bindingType]: map,
      },
    },
  };
  return proxy("PATCH", `${accountPrefix()}/pages/projects/${projectName}`, patchBody);
}

// ---------------- Worker 机密与绑定 ----------------

export async function listWorkerSecrets(scriptName: string): Promise<CfWorkerSecret[]> {
  const result = await proxy<{ secrets?: CfWorkerSecret[] } | CfWorkerSecret[]>("GET", `${accountPrefix()}/workers/scripts/${scriptName}/secrets`);
  // API 可能返回数组或 { secrets: [...] }
  if (Array.isArray(result)) return result;
  return result?.secrets ?? [];
}

export async function listWorkerBindings(scriptName: string): Promise<CfWorkerBinding[]> {
  const result = await proxy<{ bindings?: CfWorkerBinding[] } | CfWorkerBinding[]>("GET", `${accountPrefix()}/workers/scripts/${scriptName}/bindings`);
  if (Array.isArray(result)) return result;
  return result?.bindings ?? [];
}

// ---------------- Worker 脚本新建/删除 ----------------

/** 新建 Worker 脚本（PUT multipart/form-data）
 * 如果提供 code 则上传代码模块；如果提供 source 则通过 metadata.source 连接 GitHub 仓库。
 */
export async function createWorkerScript(params: CreateWorkerScriptParams): Promise<unknown> {
  const token = auth.pass;
  const panelUser = auth.panelUser;
  if (!token || !panelUser) throw new ApiError(401, "未登录");

  const metadata: Record<string, unknown> = {
    bindings: [] as CfWorkerBinding[],
  };

  // main_module 仅在有代码上传时指定（指向 worker.js 模块）
  if (params.code) {
    metadata.main_module = "worker.js";
  }

  // 如果有构建配置，加入 metadata
  if (params.build_config) {
    metadata.build_config = params.build_config;
  }

  // 如果有 GitHub 仓库源，加入 metadata.source
  if (params.source) {
    metadata.source = params.source;
  }

  const formData = new FormData();
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
  formData.append("metadata", metadataBlob);

  // 如果有代码，上传代码模块
  if (params.code) {
    const codeBlob = new Blob([params.code], { type: "application/javascript+module" });
    formData.append("worker.js", codeBlob, "worker.js");
  }

  const res = await fetch(`/api/proxy/${accountPrefix()}/workers/scripts/${params.name}`, {
    method: "PUT",
    headers: { "X-Panel-User": panelUser, "X-Panel-Pass": token },
    body: formData,
  });
  return handle<unknown>(res);
}

/** 删除 Worker 脚本 */
export async function deleteWorkerScript(name: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/workers/scripts/${name}`);
}

// ---------------- Worker 机密增删 ----------------

/** 添加/更新 Worker 机密变量 */
export async function setWorkerSecret(scriptName: string, secretName: string, text: string): Promise<unknown> {
  return proxy("PUT", `${accountPrefix()}/workers/scripts/${scriptName}/secrets`, {
    name: secretName,
    text,
    type: "secret_text",
  });
}

/** 删除 Worker 机密变量 */
export async function deleteWorkerSecret(scriptName: string, secretName: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/workers/scripts/${scriptName}/secrets/${secretName}`);
}

// ---------------- Worker 绑定增删（通过 settings 端点） ----------------

/** 获取 Worker 设置（含绑定） */
export async function getWorkerSettings(scriptName: string): Promise<CfWorkerSettings> {
  const result = await proxy<CfWorkerSettings | CfWorkerBinding[]>("GET", `${accountPrefix()}/workers/scripts/${scriptName}/settings`);
  if (Array.isArray(result)) return { bindings: result };
  return result;
}

/**
 * 更新 Worker 绑定（PATCH /settings，multipart/form-data）。
 * CF API 的 /settings 端点要求 multipart/form-data，用 JSON 会返回 415。
 * multipart body 中 settings 字段为 JSON，含完整 bindings 数组（整体替换语义）。
 */
export async function updateWorkerBindings(scriptName: string, bindings: CfWorkerBinding[]): Promise<unknown> {
  const token = auth.pass;
  const panelUser = auth.panelUser;
  if (!token || !panelUser) throw new ApiError(401, "未登录");

  const settings = { bindings };
  const formData = new FormData();
  const settingsBlob = new Blob([JSON.stringify(settings)], { type: "application/json" });
  formData.append("settings", settingsBlob, "settings.json");

  const res = await fetch(`/api/proxy/${accountPrefix()}/workers/scripts/${scriptName}/settings`, {
    method: "PATCH",
    headers: { "X-Panel-User": panelUser, "X-Panel-Pass": token },
    body: formData,
  });
  return handle<unknown>(res);
}

// ---------------- 账号信息 ----------------

export async function listAccounts(): Promise<CfAccount[]> {
  return proxy<CfAccount[]>("GET", "accounts");
}

// ---------------- API Token ----------------

export async function listApiTokens(): Promise<CfApiToken[]> {
  return proxy<CfApiToken[]>("GET", `${accountPrefix()}/tokens`);
}

export async function createApiToken(params: CreateApiTokenParams): Promise<CfApiToken & { value?: string }> {
  return proxy<CfApiToken & { value?: string }>("POST", `${accountPrefix()}/tokens`, params);
}

export async function deleteApiToken(tokenId: string): Promise<unknown> {
  return proxy("DELETE", `${accountPrefix()}/tokens/${tokenId}`);
}

export async function rotateApiTokenValue(tokenId: string): Promise<CfApiTokenValue> {
  return proxy<CfApiTokenValue>("PUT", `${accountPrefix()}/tokens/${tokenId}/value`);
}

export async function verifyApiToken(): Promise<{ id: string; status: string }[]> {
  return proxy<{ id: string; status: string }[]>("GET", `${accountPrefix()}/tokens/verify`);
}

export async function listTokenPermissionGroups(): Promise<CfTokenPermissionGroup[]> {
  return proxy<CfTokenPermissionGroup[]>("GET", `${accountPrefix()}/tokens/permission_groups`);
}