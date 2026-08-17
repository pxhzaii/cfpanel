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
    production?: { env_vars?: Record<string, unknown> };
  };
  created_on: string;
  modified_on: string;
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

/** D1 查询结果 */
export interface CfD1QueryResult {
  success: boolean;
  meta?: {
    rows_read: number;
    rows_written: number;
    duration: number;
  };
  results?: Record<string, unknown>[];
  errors?: unknown[];
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