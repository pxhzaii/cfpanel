/**
 * CFpanel 共享类型定义
 */

/** Pages Functions 环境变量 */
export interface Environment {
  /** 访问面板所需的口令（必填） */
  PANEL_PASSWORD?: string;
  /** Cloudflare API Token（必填，权限按 README 说明创建） */
  CF_API_TOKEN?: string;
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