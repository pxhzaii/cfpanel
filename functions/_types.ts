/**
 * CFpanel 共享类型定义
 */

/** Pages Functions 环境变量 */
export interface Environment {
  /** 访问面板所需的口令（必填） */
  PANEL_PASSWORD?: string;
  /** Cloudflare API Token（方式一：与 CF_API_EMAIL 二选一） */
  CF_API_TOKEN?: string;
  /** Cloudflare 账号邮箱（方式二：配合 CF_API_KEY 使用 Global API Key） */
  CF_API_EMAIL?: string;
  /** Cloudflare Global API Key（方式二：配合 CF_API_EMAIL 使用） */
  CF_API_KEY?: string;
}

/** 路由参数：/api/proxy/xxx 中的 xxx 部分 */
export interface ProxyParams {
  proxy?: string | string[];
}

export interface ApiContext {
  request: Request;
  env: Environment;
  params: ProxyParams;
}

export type ApiFunction = (context: ApiContext) => Promise<Response> | Response;