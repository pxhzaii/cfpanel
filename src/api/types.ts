/** Cloudflare API 通用响应包装 */
export interface CfResponse<T = unknown> {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: { code: number; message: string }[];
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
    total_pages: number;
    cursor?: string;
  };
}

/** 用户信息 */
export interface CfUser {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
}

/** Zone（域名） */
export interface CfZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  type: string;
  name_servers: string[];
  original_name_servers: string[];
  created_on: string;
  modified_on: string;
  activated_on: string | null;
  meta: {
    step: number;
    wildcard_proxiable: boolean;
    custom_certificate_authority: string[];
  };
  plan?: { id: string; name: string };
}

/** DNS 记录 */
export interface CfDnsRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
  created_on: string;
  modified_on: string;
  data?: Record<string, unknown>;
  meta?: { auto_added?: boolean; source?: string };
  comment?: string;
  tags?: string[];
}

/** Workers 脚本 */
export interface CfWorkerScript {
  id: string;
  created_on: string;
  modified_on: string;
  etag: string;
  handlers?: string[];
  last_deployed_from?: string;
}

/** Pages 项目 */
export interface CfPagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  source?: { type: string; config?: Record<string, unknown> };
  build_config?: {
    build_command?: string;
    destination_dir?: string;
    root_dir?: string;
  };
  deployment_configs?: {
    production?: CfPagesDeploymentConfig;
    preview?: CfPagesDeploymentConfig;
  };
  created_on: string;
  modified_on: string;
  framework?: string;
  framework_version?: string;
  production_branch?: string;
}

/** Pages 部署 */
export interface CfPagesDeployment {
  id: string;
  url: string;
  environment: string;
  created_on: string;
  modified_on: string;
  latest_stage?: { name: string; status: string };
  stages?: { name: string; status: string }[];
  deployment_trigger?: { type: string; metadata?: Record<string, unknown> };
}

/** KV 命名空间 */
export interface CfKvNamespace {
  id: string;
  title: string;
  supports_url_encoding?: boolean;
}

/** R2 存储桶 */
export interface CfR2Bucket {
  id: string;
  name: string;
  creation_date: string;
  location?: string;
  storage_class?: string;
  jurisdiction?: string;
}

/** R2 存储桶详情（GET /buckets/{name}） */
export interface CfR2BucketDetail {
  name: string;
  creation_date: string;
  location: string;
  storage_class: string;
  jurisdiction: string;
}

/** R2 对象列表项 */
export interface CfR2Object {
  key: string;
  etag: string;
  last_modified: string;
  size: number;
  http_metadata?: {
    contentType?: string;
  };
  custom_metadata?: Record<string, string>;
  storage_class?: string;
}

/** R2 对象内容（GET /objects/{key}） */
export interface CfR2ObjectContent {
  body: string;
  contentType: string;
}

/** R2 CORS 规则 */
export interface CfR2CorsRule {
  allowed: {
    origins: string[];
    methods: string[];
    headers: string[];
  };
  exposeHeaders?: string[];
  maxAgeSeconds?: number;
}

/** R2 CORS 响应 */
export interface CfR2CorsConfig {
  rules: CfR2CorsRule[];
}

/** R2 自定义域 */
export interface CfR2CustomDomain {
  domain: string;
  status: {
    ssl: string;
    ownership: string;
  };
  zoneId: string;
  zoneName: string;
  minTLS: string;
}

/** D1 数据库 */
export interface CfD1Database {
  uuid: string;
  name: string;
  created_at: string;
  version?: string;
  file_size?: number;
  num_tables?: number;
  running_integrations?: unknown[];
}

/** D1 单条 SQL 执行结果 */
export interface CfD1QueryResultItem {
  success: boolean;
  meta?: {
    rows_read: number;
    rows_written: number;
    duration: number;
    changes: number;
    last_row_id: number;
    changed_db: boolean;
    size_after: number;
  };
  results?: Record<string, unknown>[];
  errors?: unknown[];
}

/** D1 查询返回的是数组（每条 SQL 一个元素） */
export type CfD1QueryResult = CfD1QueryResultItem[];

/** Pages 环境变量条目 */
export interface CfPagesEnvVar {
  value?: string;
  type: "plain_text" | "secret_text";
}

/** Worker 密钥 */
export interface CfWorkerSecret {
  name: string;
  type: string;
}

/** Worker 绑定 */
export interface CfWorkerBinding {
  type: string;
  name: string;
  id?: string;
  namespace_id?: string;
  database_id?: string;
  bucket_name?: string;
  class_name?: string;
  environment?: string;
  text?: string;
}

/** Worker 设置（含绑定） */
export interface CfWorkerSettings {
  bindings?: CfWorkerBinding[];
}

/** Pages 绑定条目（值对象，用于 UI 展示/编辑） */
export interface CfPagesBindingEntry {
  variable_name: string;
  namespace_id?: string;
  bucket_name?: string;
  id?: string;
}

/**
 * Pages 绑定在 CF API 中是 **map 对象** 格式（不是数组！）：
 *   kv_namespaces: { "TOTP_KV": { namespace_id: "..." } }
 *   r2_buckets:    { "BIND": { name: "bucket" } }
 *   d1_databases:  { "BIND": { id: "uuid" } }
 * 注意 key 是变量名（binding），value 是资源定位字段。
 * value 为 null 时表示删除该绑定（CF API 合并语义）。
 */
export type CfPagesBindingMap = Record<string, { namespace_id?: string; name?: string; id?: string } | null>;

/** Pages 部署配置（含绑定） */
export interface CfPagesDeploymentConfig {
  env_vars?: Record<string, unknown>;
  kv_namespaces?: CfPagesBindingMap;
  r2_buckets?: CfPagesBindingMap;
  d1_databases?: CfPagesBindingMap;
}

/** Worker 脚本创建参数 */
export interface CreateWorkerScriptParams {
  name: string;
  code?: string;
  build_config?: {
    build_command?: string;
    destination_dir?: string;
    root_dir?: string;
  };
  source?: {
    type: "github";
    config: {
      owner: string;
      repo_name: string;
      production_branch?: string;
      deployments_enabled?: boolean;
    };
  };
}

/** Pages 项目创建参数（含 GitHub 仓库源 + 构建配置） */
export interface CreatePagesProjectParams {
  name: string;
  production_branch?: string;
  source?: {
    type: "github";
    config: {
      owner: string;
      repo_name: string;
      production_branch?: string;
      deployments_enabled?: boolean;
    };
  };
  build_config?: {
    build_command?: string;
    destination_dir?: string;
    root_dir?: string;
  };
}

/** 账号信息 */
export interface CfAccount {
  id: string;
  name: string;
  type: string;
  created_on: string;
}

/** KV key 列表项 */
export interface CfKvKey {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

/** 通用分页请求参数 */
export interface PageParams {
  page?: number;
  per_page?: number;
}

export interface DnsRecordForm {
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  comment?: string;
  priority?: number;
}