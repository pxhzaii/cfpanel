/**
 * CFpanel 共享类型定义
 */

/** Pages Functions 环境变量 */
export interface Environment {
  /** 面板用户列表（JSON 字符串，如 [{"username":"admin","password":"xxx"}]） */
  PANEL_USERS?: string;
  /** Cloudflare API Token（必填，权限按 README 说明创建） */
  CF_API_TOKEN?: string;
  /** GitHub Token（用于推空 commit 触发 Pages 重新部署，需 repo 权限） */
  GH_TOKEN?: string;
}

/** 路由参数：/api/proxy/xxx 中的 xxx 部分 */
export interface ProxyParams {
  proxy?: string | string[];
}

export interface ApiContext {
  request: Request;
  env: Environment;
  params: ProxyParams;
  /** Cloudflare Pages Functions 上下文，提供 waitUntil 等 */
  ctx?: {
    waitUntil: (promise: Promise<unknown>) => void;
  };
}

export type ApiFunction = (context: ApiContext) => Promise<Response> | Response;